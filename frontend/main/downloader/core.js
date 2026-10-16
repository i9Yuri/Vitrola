/**
 * VITROLA - DOWNLOADER CORE (src/main/downloader/core.js)
 * Regras de flags e argumentos do yt-dlp, purga de artefatos parciais (.part/.ytdl)
 * e injeção mandante de --no-continue para erradicar o erro HTTP 416.
 */

const fs = require('fs');
const path = require('path');
const { purgeOrphanThumbnails } = require('./post-processor');

let electronApp = null;
try {
  const electron = require('electron');
  electronApp = electron.app;
} catch (_) {}

/**
 * Resolução dinâmica e resiliente do caminho absoluto dos binários internos empacotados
 * via process.resourcesPath ou extração do ASAR (app.asar.unpacked/bin/),
 * com fallback para ambiente de desenvolvimento local e diretórios do sistema operacional.
 * @param {'yt-dlp' | 'ffmpeg'} binaryName
 * @returns {string} Caminho absoluto para o binário executável
 */
function getExecutableBinaryPath(binaryName) {
  if (!binaryName) return '';

  const isPackaged = electronApp
    ? Boolean(electronApp.isPackaged)
    : (process.mainModule && process.mainModule.filename && process.mainModule.filename.includes('app.asar'));

  // 1. Resolução em ambiente empacotado (asarUnpack ou extraResources)
  if (isPackaged && process.resourcesPath) {
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', binaryName);
    if (fs.existsSync(unpackedPath)) {
      try {
        fs.chmodSync(unpackedPath, 0o755);
      } catch (_) {}
      return unpackedPath;
    }

    const resourcesBinPath = path.join(process.resourcesPath, 'bin', binaryName);
    if (fs.existsSync(resourcesBinPath)) {
      try {
        fs.chmodSync(resourcesBinPath, 0o755);
      } catch (_) {}
      return resourcesBinPath;
    }
  }

  // 2. Resolução em ambiente de desenvolvimento local (diretório bin/ na raiz do projeto)
  const localProjectBin = path.resolve(__dirname, '../../../bin', binaryName);
  if (fs.existsSync(localProjectBin)) {
    try {
      fs.chmodSync(localProjectBin, 0o755);
    } catch (_) {}
    return localProjectBin;
  }

  const altLocalBin = path.resolve(__dirname, '../../bin', binaryName);
  if (fs.existsSync(altLocalBin)) {
    try {
      fs.chmodSync(altLocalBin, 0o755);
    } catch (_) {}
    return altLocalBin;
  }

  // 3. Fallback no sistema operacional
  const systemCandidates = [
    `/usr/local/bin/${binaryName}`,
    `/usr/bin/${binaryName}`,
    binaryName
  ];

  for (const candidate of systemCandidates) {
    if (candidate === binaryName || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return binaryName;
}

const SUPPORTED_THUMBNAIL_CONTAINERS = new Set([
  'mp3', 'mkv', 'mka', 'ogg', 'opus', 'flac', 'm4a', 'mp4', 'm4v', 'mov'
]);

/**
 * Valida se o contêiner suporta embutir miniaturas via Mutagen/yt-dlp.
 * @param {string} [containerFormat]
 * @param {string} [audioCodec]
 * @returns {boolean}
 */
function canEmbedThumbnail(containerFormat, audioCodec) {
  if (!containerFormat) return false;
  const fmt = String(containerFormat).trim().toLowerCase();
  return SUPPORTED_THUMBNAIL_CONTAINERS.has(fmt);
}

/**
 * Extrai o identificador de vídeo (v=... ou youtu.be/...) de uma URL caso disponível.
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v');
    }
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0];
    }
  } catch (_) {}
  return null;
}

/**
 * Purga de forma síncrona e defensiva quaisquer arquivos residuais .part ou .ytdl.
 * Captura exceções de concorrência ou permissão sem interromper o fluxo principal.
 * @param {string} targetDir
 * @param {string} [mediaTitle]
 * @param {string} [videoId]
 */
function purgePartialDownloadArtifacts(targetDir, mediaTitle = '', videoId = null) {
  if (!targetDir) return;
  try {
    if (!fs.existsSync(targetDir)) return;

    const files = fs.readdirSync(targetDir);
    const idStr = videoId ? String(videoId).trim() : null;
    const cleanTitle = mediaTitle
      ? String(mediaTitle).replace(/[^\w\s\-\.\u00C0-\u017F]/gi, '').trim().toLowerCase()
      : '';

    for (const file of files) {
      const lowerFile = file.toLowerCase();
      const isPartial = (
        lowerFile.endsWith('.part') ||
        lowerFile.endsWith('.ytdl') ||
        lowerFile.includes('.part-') ||
        lowerFile.endsWith('.temp')
      );

      if (!isPartial) continue;

      let match = false;
      if (idStr && lowerFile.includes(idStr.toLowerCase())) {
        match = true;
      } else if (cleanTitle && cleanTitle.length >= 4) {
        const prefix = cleanTitle.slice(0, 15);
        if (lowerFile.includes(prefix)) {
          match = true;
        }
      }

      if (match) {
        try {
          const filePath = path.join(targetDir, file);
          fs.unlinkSync(filePath);
          console.log(`[Downloader] Purged partial artifact: ${file}`);
        } catch (unlinkErr) {
          console.warn(`[Downloader] Warning: Could not remove locked partial file ${file}: ${unlinkErr.message}`);
        }
      }
    }
  } catch (err) {
    console.warn(`[Downloader] Warning during partial artifacts scan in ${targetDir}: ${err.message}`);
  }
}

/**
 * Constrói argumentos seguros para o yt-dlp garantindo conformidade com o schema DownloadOptions.
 * @param {Object} options
 * @param {string} options.url
 * @param {string} [options.targetPath]
 * @param {string} [options.outputDir]
 * @param {boolean} [options.isOriginal]
 * @param {boolean} [options.disableContinue=true]
 * @returns {string[]}
 */
function buildYtDlpDownloadArgs(options = {}) {
  const {
    url,
    targetPath,
    outputDir = targetPath,
    isOriginal = false,
    disableContinue = true,
    mode = 'audio',
    formatId,
    targetRes = 1080,
    embedMetadata = true,
    embedThumbnail = true,
    embedSubtitles = false,
    subtitleLang,
    targetFormat
  } = options;

  const args = [
    '--no-playlist',
    '--ignore-config',
    '--windows-filenames',
    '--newline',
    '--no-part',               // Download direto sem renomeação .part
    '--concurrent-fragments', '1' // Download sequencial atômico desde byte 0
  ];

  // Injeção mandante de --no-continue para erradicar HTTP Error 416
  if (disableContinue !== false) {
    args.push('--no-continue');
  }

  if (outputDir) {
    args.push('-o', `${outputDir}/%(title)s.%(ext)s`);
  }

  const ffmpegLocation = getExecutableBinaryPath('ffmpeg');
  if (ffmpegLocation) {
    args.push('--ffmpeg-location', ffmpegLocation);
  }

  const isOrig = Boolean(
    isOriginal ||
    String(targetFormat).toLowerCase() === 'original' ||
    String(formatId).toLowerCase() === 'original'
  );

  if (mode === 'audio') {
    if (isOrig) {
      args.push('-f', 'bestaudio/best');
    } else if (formatId) {
      args.push('-f', formatId);
    } else {
      args.push('-f', 'ba[ext=opus]/ba[ext=m4a]/ba');
    }

    // Remux atômico direto/lossless para contêiner de áudio legítimo (.opus/.m4a/.mp3)
    // eliminando contêiner WebM órfão e arquivos residuais
    const audioFmt = isOrig ? 'best' : (targetFormat || 'best');
    args.push('-x', '--audio-format', audioFmt, '--no-keep-video');

    if (embedMetadata) {
      args.push('--add-metadata');
    }

    if (embedThumbnail) {
      args.push('--embed-thumbnail');
    }

    if (embedSubtitles) {
      args.push('--write-subs', '--sub-langs', subtitleLang || 'all', '--embed-subs');
    }
  } else {
    // Mode Video
    if (isOrig) {
      args.push('-f', 'bestvideo+bestaudio/best');
    } else if (formatId) {
      args.push('-f', `${formatId}+bestaudio[ext=m4a]/bestaudio/best`);
      args.push('--merge-output-format', 'mp4');
    } else {
      args.push('-f', `bestvideo[height<=${targetRes}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${targetRes}]+bestaudio/best[height<=${targetRes}]`);
      args.push('--merge-output-format', 'mp4');
    }

    if (embedMetadata) {
      args.push('--add-metadata');
    }

    if (embedThumbnail) {
      const isIncompatible = isOrig && (!targetFormat || !canEmbedThumbnail(targetFormat));
      if (isIncompatible) {
        args.push('--write-thumbnail');
      } else {
        args.push('--embed-thumbnail');
      }
    }

    if (embedSubtitles) {
      args.push('--write-subs', '--sub-langs', subtitleLang || 'pt,en.*', '--embed-subs');
    }
  }

  if (url) {
    args.push(url);
  }

  return args;
}

const buildDownloadArgs = buildYtDlpDownloadArgs;

/**
 * Constrói os argumentos de linha de comando para download de áudio em arquivo único,
 * com extração atômica via FFmpeg, metadados e thumbnail embutidos diretamente no contêiner de áudio.
 * @param {Object} payload
 * @param {string} payload.url
 * @param {string} [payload.targetDirectory]
 * @param {string} [payload.format='original']
 * @param {boolean} [payload.embedThumbnail=true]
 * @param {boolean} [payload.embedMetadata=true]
 * @returns {string[]}
 */
function buildSingleFileAudioArgs(payload = {}) {
  const {
    url,
    targetDirectory,
    format = 'original',
    embedThumbnail = true,
    embedMetadata = true
  } = payload;

  const targetFmt = String(format).toLowerCase() === 'original' ? 'best' : format;

  const args = [
    '--no-playlist',
    '--ignore-config',
    '--windows-filenames',
    '--newline',
    '--no-part',
    '--concurrent-fragments', '1',
    '--no-continue'
  ];

  if (targetDirectory) {
    args.push('-o', `${targetDirectory}/%(title)s.%(ext)s`);
  }

  const ffmpegLocation = getExecutableBinaryPath('ffmpeg');
  if (ffmpegLocation) {
    args.push('--ffmpeg-location', ffmpegLocation);
  }

  args.push('-x', '--audio-format', targetFmt, '--no-keep-video');

  if (embedMetadata) {
    args.push('--add-metadata');
  }

  if (embedThumbnail) {
    args.push('--embed-thumbnail');
  }

  if (url) {
    args.push(url);
  }

  return args;
}

module.exports = {
  SUPPORTED_THUMBNAIL_CONTAINERS,
  canEmbedThumbnail,
  extractVideoId,
  getExecutableBinaryPath,
  purgePartialDownloadArtifacts,
  purgeOrphanThumbnails,
  buildYtDlpDownloadArgs,
  buildDownloadArgs,
  buildSingleFileAudioArgs
};

