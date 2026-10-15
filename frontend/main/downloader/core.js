/**
 * VITROLA - DOWNLOADER CORE (src/main/downloader/core.js)
 * Regras de flags e argumentos do yt-dlp, supressão condicional de --embed-thumbnail
 * para formatos brutos incompatíveis (WebM nativo) e rotinas de retry.
 */

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
 * Monta os argumentos seguros para execução do yt-dlp.
 * @param {Object} options
 * @returns {string[]}
 */
function buildDownloadArgs(options = {}) {
  const {
    url,
    mode = 'audio',
    outputDir,
    formatId,
    targetRes = 1080,
    embedMetadata = true,
    embedThumbnail = true,
    embedSubtitles = false,
    subtitleLang,
    isOriginalQuality = false,
    targetFormat
  } = options;

  const args = [
    '--no-playlist',
    '--ignore-config',
    '--windows-filenames',
    '--newline'
  ];

  if (outputDir) {
    args.push('-o', `${outputDir}/%(title)s.%(ext)s`);
  }

  const isOriginal = isOriginalQuality ||
    String(targetFormat).toLowerCase() === 'original' ||
    String(formatId).toLowerCase() === 'original';

  if (mode === 'audio') {
    if (isOriginal) {
      args.push('-f', 'bestaudio/best');
    } else if (formatId) {
      args.push('-f', formatId);
    } else {
      args.push('-f', 'ba[ext=opus]/ba[ext=m4a]/ba');
    }

    if (embedMetadata) {
      args.push('--add-metadata');
    }

    if (embedThumbnail) {
      const isIncompatible = (
        isOriginal ||
        (targetFormat && ['webm', 'original', 'source'].includes(String(targetFormat).toLowerCase()))
      ) && (!targetFormat || !canEmbedThumbnail(targetFormat));

      if (isIncompatible) {
        args.push('--write-thumbnail');
      } else {
        args.push('--embed-thumbnail');
      }
    }

    if (embedSubtitles) {
      args.push('--write-subs', '--sub-langs', subtitleLang || 'all', '--embed-subs');
    }
  } else {
    // Mode Video
    if (isOriginal) {
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
      const isIncompatible = isOriginal && (!targetFormat || !canEmbedThumbnail(targetFormat));
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

module.exports = {
  SUPPORTED_THUMBNAIL_CONTAINERS,
  canEmbedThumbnail,
  buildDownloadArgs
};
