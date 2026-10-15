/**
 * VITROLA - ELECTRON PRELOAD SCRIPT (preload.js)
 * Isolamento de contexto estrito e exposição de API segura para o Renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // Window Controls
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  minimize: () => {
    try { ipcRenderer.send('window:minimize'); } catch (_) {}
    return ipcRenderer.invoke('window:minimize');
  },
  maximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => {
    try { ipcRenderer.send('window:forceClose'); } catch (_) {}
    return ipcRenderer.invoke('window:closeApp');
  },
  forceClose: () => {
    try { ipcRenderer.send('window:forceClose'); } catch (_) {}
    return ipcRenderer.invoke('window:forceClose');
  },
  startWindowDrag: () => ipcRenderer.invoke('window:action', 'start_drag'),
  onMinimizedState: (callback) => {
    if (typeof callback === 'function') {
      const handler = (_event, isMinimized) => callback(isMinimized);
      ipcRenderer.on('window:minimized-state', handler);
      return () => ipcRenderer.removeListener('window:minimized-state', handler);
    }
  },

  // Storage & Filesystem
  getDefaultDirectory: () => ipcRenderer.invoke('storage:getDefaultDirectory'),
  openDirectory: (dirPath) => ipcRenderer.invoke('storage:openTargetDirectory', dirPath),
  selectDirectory: (currentPath) => ipcRenderer.invoke('storage:updateTargetDirectory', currentPath),
  checkAndShowItem: (filePath) => ipcRenderer.invoke('storage:openTargetDirectory', filePath),
  getDirectoryTelemetry: (dirPath) => ipcRenderer.invoke('storage:getDirectoryTelemetry', dirPath),
  getDownloadPath: () => ipcRenderer.invoke('settings:getDownloadPath'),
  changeDownloadPath: (currentPath) => ipcRenderer.invoke('settings:changeDownloadPath', currentPath),
  revealDownloadPath: (dirPath) => ipcRenderer.invoke('settings:revealDownloadPath', dirPath),

  // Clipboard
  readClipboard: () => ipcRenderer.invoke('clipboard:read-text'),
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text'),
  clipboardReadText: () => ipcRenderer.invoke('clipboard:read-text'),
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:read-text')
  },

  // Download Diagnostics & Retry
  retryTask: (taskId) => ipcRenderer.invoke('download:retryTask', taskId),
  getErrorDetails: (taskId) => ipcRenderer.invoke('download:getErrorDetails', taskId),
  download: {
    retryTask: (taskId) => ipcRenderer.invoke('download:retryTask', taskId),
    getErrorDetails: (taskId) => ipcRenderer.invoke('download:getErrorDetails', taskId)
  },

  // System & App Metadata
  getAppMetadata: () => ipcRenderer.invoke('system:getAppMetadata'),

  // History Management
  getHistory: () => ipcRenderer.invoke('history:getAggregated'),
  deleteHistoryItem: (mediaKey) => ipcRenderer.invoke('history:deleteItem', mediaKey),
  clearAllHistory: () => ipcRenderer.invoke('history:clearAll'),
};

try {
  if (contextBridge && contextBridge.exposeInMainWorld) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } else {
    window.electronAPI = electronAPI;
  }
} catch (error) {
  console.error('[Preload] Falha ao expor electronAPI:', error);
}

module.exports = { electronAPI };
