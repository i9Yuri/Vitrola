/**
 * VITROLA - DOWNLOAD IPC HANDLER (src/main/ipc/download-handler.js)
 * Handlers IPC para consulta de detalhes de falha, task-store e reprocessamento com purga de resíduos.
 */

const { parseDownloadError } = require('../downloader/error-handler');
const { registerDownloadFailure, retrieveDownloadFailure, clearDownloadFailure } = require('../downloader/task-store');
const { purgePartialDownloadArtifacts } = require('../downloader/core');

// Registro em memória de falhas estruturadas por taskId
const taskErrorsRegistry = new Map();

/**
 * Registra ou atualiza um erro de download estruturado.
 * @param {string} taskId
 * @param {string[]|string} rawLogs
 * @param {number} [exitCode=1]
 * @param {string} [mediaTitle]
 */
function recordTaskError(taskId, rawLogs, exitCode = 1, mediaTitle = '') {
  const parsed = parseDownloadError(taskId, rawLogs, exitCode);
  const failurePayload = {
    taskId: String(taskId),
    mediaTitle: mediaTitle || 'Mídia Desconhecida',
    httpStatus: (parsed.rawErrorLog && parsed.rawErrorLog.includes('416')) ? 416 : undefined,
    message: parsed.summary,
    rawLog: parsed.rawErrorLog,
    timestamp: new Date().toISOString(),
    suggestedAction: parsed.suggestedAction,
    isThumbnailError: parsed.isThumbnailError
  };
  registerDownloadFailure(taskId, failurePayload);
  taskErrorsRegistry.set(String(taskId), failurePayload);
  return failurePayload;
}

/**
 * Registra os canais IPC do downloader no processo Main do Electron.
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} [deps]
 */
function registerDownloadHandlers(ipcMain, deps = {}) {
  if (!ipcMain) return;

  // download:getErrorDetails
  ipcMain.handle('download:getErrorDetails', async (event, taskId) => {
    const tid = String(taskId);
    const inStore = retrieveDownloadFailure(tid);
    if (inStore) {
      return inStore;
    }
    if (taskErrorsRegistry.has(tid)) {
      return taskErrorsRegistry.get(tid);
    }

    // Tenta consultar do backend HTTP local se não estiver no registro local
    try {
      const http = require('http');
      return await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:8000/api/download/error-details?taskId=${encodeURIComponent(tid)}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json && json.success && json.error_details) {
                const ed = json.error_details;
                const failurePayload = {
                  taskId: tid,
                  mediaTitle: ed.mediaTitle || ed.title || 'Mídia Desconhecida',
                  httpStatus: ed.httpStatus || (ed.rawErrorLog && ed.rawErrorLog.includes('416') ? 416 : undefined),
                  message: ed.message || ed.summary || 'Falha no download da mídia.',
                  rawLog: ed.rawLog || ed.rawErrorLog || '',
                  timestamp: ed.timestamp || new Date().toISOString(),
                  suggestedAction: ed.suggestedAction,
                  isThumbnailError: Boolean(ed.isThumbnailError)
                };
                registerDownloadFailure(tid, failurePayload);
                taskErrorsRegistry.set(tid, failurePayload);
                return resolve(failurePayload);
              }
            } catch (_) {}
            resolve(fallbackError(tid));
          });
        });
        req.on('error', () => resolve(fallbackError(tid)));
        req.setTimeout(1500, () => { req.destroy(); resolve(fallbackError(tid)); });
      });
    } catch (_) {
      return fallbackError(tid);
    }
  });

  // download:retryTask
  ipcMain.handle('download:retryTask', async (event, taskId) => {
    const tid = String(taskId);
    const existing = retrieveDownloadFailure(tid) || taskErrorsRegistry.get(tid);
    const suppressThumb = existing ? existing.isThumbnailError : false;

    // Purga preventiva de resíduos parciais antes de reprocessar
    try {
      const path = require('path');
      const os = require('os');
      const downloadDir = path.join(os.homedir(), 'Downloads');
      purgePartialDownloadArtifacts(downloadDir, existing?.mediaTitle || '');
    } catch (_) {}

    try {
      const http = require('http');
      const payload = JSON.stringify({ taskId: tid, suppressThumbnail: suppressThumb });
      return await new Promise((resolve) => {
        const req = http.request(
          'http://127.0.0.1:8000/api/download/retry',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          },
          (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (json && json.success) {
                  clearDownloadFailure(tid);
                  taskErrorsRegistry.delete(tid);
                  return resolve({ success: true });
                }
              } catch (_) {}
              resolve({ success: false, error: 'Falha ao reprocessar tarefa' });
            });
          }
        );
        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.setTimeout(3000, () => { req.destroy(); resolve({ success: false, error: 'Timeout ao conectar com o serviço' }); });
        req.write(payload);
        req.end();
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

function fallbackError(taskId) {
  return {
    taskId: String(taskId),
    mediaTitle: 'Mídia Desconhecida',
    message: 'Ocorreu uma falha no processamento deste download.',
    rawLog: 'Nenhum log detalhado foi retornado para esta tarefa.',
    timestamp: new Date().toISOString(),
    suggestedAction: 'Clique em "Tentar Novamente" para reiniciar a requisição de download de forma limpa.',
    isThumbnailError: false
  };
}

module.exports = {
  recordTaskError,
  registerDownloadHandlers
};
