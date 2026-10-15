/**
 * VITROLA - TELEMETRIA DE ARMAZENAMENTO LOCAL (storage-telemetry.js)
 * Varredura assíncrona não bloqueante de arquivos de mídia e cálculo de capacidade do disco.
 */

const fs = require('fs');
const path = require('path');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.opus', '.m4a', '.aac', '.wav', '.ogg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv']);

function formatSizeBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${units[i]}`;
}

/**
 * Coleta assíncrona de telemetria da pasta de download
 * @param {string} targetDir Caminho da pasta
 * @returns {Promise<{ isAvailable: boolean, totalSizeBytes: number, formattedSize: string, audioCount: number, videoCount: number, percentUsed: number, path: string }>}
 */
async function getStorageTelemetry(targetDir) {
  if (!targetDir) {
    return {
      isAvailable: false,
      totalSizeBytes: 0,
      formattedSize: '0 B',
      audioCount: 0,
      videoCount: 0,
      percentUsed: 0,
      path: ''
    };
  }

  try {
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (_) {
        return {
          isAvailable: false,
          totalSizeBytes: 0,
          formattedSize: 'Caminho indisponível',
          audioCount: 0,
          videoCount: 0,
          percentUsed: 0,
          path: targetDir
        };
      }
    }

    let totalSizeBytes = 0;
    let audioCount = 0;
    let videoCount = 0;

    // Varredura superficial e de subdiretórios de primeiro nível
    const queue = [targetDir];
    let depth = 0;

    while (queue.length > 0 && depth < 200) {
      depth++;
      const currentDir = queue.shift();
      let entries = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (_) {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // Não entrar em pastas ocultas
          if (!entry.name.startsWith('.')) {
            queue.push(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (AUDIO_EXTENSIONS.has(ext)) {
            audioCount++;
            try {
              const stat = await fs.promises.stat(fullPath);
              totalSizeBytes += stat.size;
            } catch (_) {}
          } else if (VIDEO_EXTENSIONS.has(ext)) {
            videoCount++;
            try {
              const stat = await fs.promises.stat(fullPath);
              totalSizeBytes += stat.size;
            } catch (_) {}
          }
        }
      }
    }

    // Cálculo de ocupação da partição com fs.statfs
    let percentUsed = 20; // fallback padrão
    try {
      if (typeof fs.promises.statfs === 'function') {
        const stat = await fs.promises.statfs(targetDir);
        const total = stat.bsize * stat.blocks;
        const free = stat.bsize * stat.bfree;
        if (total > 0) {
          percentUsed = Math.min(100, Math.max(1, Math.round(((total - free) / total) * 100)));
        }
      }
    } catch (_) {}

    return {
      isAvailable: true,
      totalSizeBytes,
      formattedSize: formatSizeBytes(totalSizeBytes),
      audioCount,
      videoCount,
      percentUsed,
      path: targetDir
    };
  } catch (err) {
    return {
      isAvailable: false,
      totalSizeBytes: 0,
      formattedSize: 'Caminho indisponível',
      audioCount: 0,
      videoCount: 0,
      percentUsed: 0,
      path: targetDir,
      error: err.message
    };
  }
}

module.exports = {
  getStorageTelemetry,
  formatSizeBytes
};
