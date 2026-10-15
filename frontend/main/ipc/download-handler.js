/**
 * VITROLA - DOWNLOAD IPC HANDLER (src/main/ipc/download-handler.js)
 * Handlers IPC para consulta de detalhes de falha e reprocessamento de tarefas.
 */

const { parseDownloadError } = require('../downloader/error-handler');

// Registro em memória de falhas estruturadas por taskId
const taskErrorsRegistry = new Map();

/**
 * Registra ou atualiza um erro de download estruturado.
 * @param {string} taskId
 * @param {string[]|string} rawLogs
 * @param {number} [exitCode=1]
 */
function recordTaskError(taskId, rawLogs, exitCode = 1) {
  const parsed = parseDownloadError(taskId, rawLogs, exitCode);
  taskErrorsRegistry.set(String(taskId), parsed);
  return parsed;
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
                taskErrorsRegistry.set(tid, json.error_details);
                return resolve(json.error_details);
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
    const existing = taskErrorsRegistry.get(tid);
    const suppressThumb = existing ? existing.isThumbnailError : false;

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
    summary: 'Ocorreu uma falha no processamento deste download.',
    rawErrorLog: 'Nenhum log detalhado foi retornado para esta tarefa.',
    suggestedAction: 'Clique em "Tentar novamente" para reiniciar a requisição de download.',
    isThumbnailError: false
  };
}

module.exports = {
  recordTaskError,
  registerDownloadHandlers
};
