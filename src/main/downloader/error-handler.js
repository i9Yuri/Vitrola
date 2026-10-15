/**
 * VITROLA - DOWNLOADER ERROR HANDLER (src/main/downloader/error-handler.js)
 * Captura, parsing estruturado e persistência de mensagens de falha e logs técnicos do yt-dlp/FFmpeg.
 */

/**
 * Sanitiza e estrutura as mensagens de falha para apresentação ao usuário final e telemetria.
 * @param {string} taskId
 * @param {string[]|string} rawLogs
 * @param {number} [exitCode=1]
 * @returns {{ taskId: string, summary: string, rawErrorLog: string, suggestedAction: string, isThumbnailError: boolean }}
 */
function parseDownloadError(taskId, rawLogs, exitCode = 1) {
  const logLines = Array.isArray(rawLogs)
    ? rawLogs
    : String(rawLogs || '').split('\n').filter(Boolean);

  const rawText = logLines.join('\n');

  let summary = 'Ocorreu um erro durante o processamento da mídia.';
  let suggestedAction = 'Tente novamente ou verifique se o link ainda está disponível online.';
  let isThumbnailError = false;

  // 1. Erro fatal de embutição de miniatura
  if (
    rawText.includes('Supported filetypes for thumbnail embedding are:') ||
    rawText.includes('Embedding thumbnail') ||
    rawText.includes('Postprocessing: Error') && rawText.includes('thumbnail')
  ) {
    isThumbnailError = true;
    summary = 'O formato bruto extraído (WebM) não suporta miniatura embutida internamente.';
    suggestedAction = 'Clique em "Tentar novamente". O Vitrola salvará o áudio com integridade máxima desativando a miniatura interna.';
  }
  // 2. Erros de conectividade / rede
  else if (
    rawText.includes('Network is unreachable') ||
    rawText.includes('Connection refused') ||
    rawText.includes('Connection reset') ||
    rawText.includes('timed out') ||
    rawText.includes('HTTP Error 429') ||
    rawText.includes('Too Many Requests')
  ) {
    summary = 'Falha de conexão com os servidores do serviço de mídia.';
    suggestedAction = 'Verifique sua conexão com a internet e tente novamente em instantes.';
  }
  // 3. Vídeo privado ou indisponível
  else if (rawText.includes('Private video') || rawText.includes('This video is private')) {
    summary = 'Esta mídia é privada e não está acessível publicamente.';
    suggestedAction = 'Verifique as permissões de acesso ao conteúdo.';
  }
  // 4. Restrição de idade
  else if (rawText.includes('Sign in to confirm your age') || rawText.includes('age-restricted')) {
    summary = 'Conteúdo com restrição de idade que exige autenticação prévia.';
    suggestedAction = 'Este conteúdo não pode ser extraído diretamente sem credenciais de acesso.';
  }
  // 5. Linha primária destacada do log
  else {
    const errorLine = logLines
      .slice()
      .reverse()
      .find((l) => l.includes('ERROR:') || l.includes('Error:') || l.includes('error:'));

    if (errorLine) {
      const sanitized = errorLine
        .replace(/^.*ERROR:\s*/i, '')
        .replace(/^.*\[download\] Got error:\s*/i, '')
        .replace(/^Postprocessing:\s*/i, '')
        .trim();
      if (sanitized) {
        summary = sanitized;
      }
    }
  }

  return {
    taskId: String(taskId),
    summary,
    rawErrorLog: rawText || `Processo finalizado com código ${exitCode}`,
    suggestedAction,
    isThumbnailError
  };
}

module.exports = {
  parseDownloadError
};
