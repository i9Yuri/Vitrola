/**
 * VITROLA - DOWNLOADER POST PROCESSOR (src/main/downloader/post-processor.js)
 * Rotina de limpeza defensiva de arquivos auxiliares (.webp, .png, .jpg, .temp, .webm órfão)
 * após a consolidação atômica de áudio em arquivo único.
 */

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.temp']);

/**
 * Varre o diretório do arquivo final buscando resíduos homônimos com extensões de imagem
 * ou contêineres intermediários criados na mesma janela de tempo e os remove sumariamente.
 * @param {string} outputAudioPath - Caminho absoluto para o arquivo de áudio final consolidado
 */
function purgeOrphanThumbnails(outputAudioPath) {
  if (!outputAudioPath) return;

  try {
    const p = path.resolve(outputAudioPath);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) return;

    const audioExt = path.extname(p).toLowerCase();
    const baseName = path.basename(p, path.extname(p));
    const cleanBase = baseName.replace(/[^\w\s\-\.\u00C0-\u017F]/gi, '').trim().toLowerCase();

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fullPath === p) {
        // Nunca remove o arquivo de áudio final consolidado
        continue;
      }

      const fileExt = path.extname(file).toLowerCase();
      const fileNameWithoutExt = path.basename(file, fileExt);
      const cleanFileName = fileNameWithoutExt.replace(/[^\w\s\-\.\u00C0-\u017F]/gi, '').trim().toLowerCase();

      // Identifica artefatos de imagem órfãos ou contêiner intermediário webm quando o destino não é webm
      const isOrphanImage = IMAGE_EXTENSIONS.has(fileExt);
      const isOrphanIntermediate = (fileExt === '.webm' && audioExt !== '.webm') || file.endsWith('.ytdl') || file.endsWith('.part');

      if (!isOrphanImage && !isOrphanIntermediate) {
        continue;
      }

      // Verifica correspondência por nome exato ou prefixo sanitizado
      let isMatch = false;
      if (fileNameWithoutExt === baseName || cleanFileName === cleanBase) {
        isMatch = true;
      } else if (cleanBase.length >= 4 && (cleanFileName.startsWith(cleanBase.slice(0, 15)) || cleanBase.startsWith(cleanFileName.slice(0, 15)))) {
        isMatch = true;
      }

      if (isMatch) {
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`[PostProcessor] Purged orphan artifact: ${file}`);
          }
        } catch (unlinkErr) {
          console.warn(`[PostProcessor] Warning: Could not remove orphan file ${file}:`, unlinkErr.message);
        }
      }
    }
  } catch (err) {
    console.warn(`[PostProcessor] Error scanning directory for orphan artifacts:`, err.message);
  }
}

module.exports = {
  purgeOrphanThumbnails
};
