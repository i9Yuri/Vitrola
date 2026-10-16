/**
 * VITROLA - TASK FAILURE STORE (src/main/downloader/task-store.js)
 * Mapeamento em memória de logs e metadados de erro indexados por taskId para consulta IPC.
 */

/**
 * @typedef {Object} DownloadFailureDetails
 * @property {string} taskId
 * @property {string} mediaTitle
 * @property {number} [httpStatus]
 * @property {string} message
 * @property {string} rawLog
 * @property {string} timestamp
 * @property {string} [suggestedAction]
 * @property {boolean} [isThumbnailError]
 */

const failureStore = new Map();

/**
 * Registra ou atualiza os detalhes de falha de uma tarefa de download.
 * @param {string} taskId
 * @param {DownloadFailureDetails} errorPayload
 */
function registerDownloadFailure(taskId, errorPayload) {
  if (!taskId) return;
  const tid = String(taskId);
  const rawLog = errorPayload?.rawLog || errorPayload?.rawErrorLog || errorPayload?.raw_log || '';
  const is416 = rawLog.includes('416') || (errorPayload?.message && errorPayload.message.includes('416'));
  const httpStatus = errorPayload?.httpStatus || (is416 ? 416 : undefined);

  const normalized = {
    taskId: tid,
    mediaTitle: errorPayload?.mediaTitle || errorPayload?.title || 'Mídia Desconhecida',
    httpStatus,
    message: errorPayload?.message || errorPayload?.summary || 'Ocorreu uma falha no download.',
    rawLog,
    timestamp: errorPayload?.timestamp || new Date().toISOString(),
    suggestedAction: errorPayload?.suggestedAction || (
      httpStatus === 416
        ? 'Arquivos parciais corrompidos foram limpos. Clique em "Tentar Novamente" para reiniciar o download de forma limpa.'
        : 'Tente novamente ou verifique a conexão com o link.'
    ),
    isThumbnailError: Boolean(errorPayload?.isThumbnailError)
  };
  failureStore.set(tid, normalized);
}

/**
 * Consulta os detalhes de falha de uma tarefa pelo identificador.
 * @param {string} taskId
 * @returns {DownloadFailureDetails|null}
 */
function retrieveDownloadFailure(taskId) {
  if (!taskId) return null;
  return failureStore.get(String(taskId)) || null;
}

/**
 * Limpa o registro de falha de uma tarefa após retentativa bem-sucedida ou reinício.
 * @param {string} taskId
 */
function clearDownloadFailure(taskId) {
  if (!taskId) return;
  failureStore.delete(String(taskId));
}

/**
 * Retorna todos os registros em memória.
 * @returns {Map<string, DownloadFailureDetails>}
 */
function getAllDownloadFailures() {
  return new Map(failureStore);
}

module.exports = {
  registerDownloadFailure,
  retrieveDownloadFailure,
  clearDownloadFailure,
  getAllDownloadFailures
};
