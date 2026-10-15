/**
 * VITROLA - ELECTRON PRELOAD SCRIPT (preload.js)
 * Isolamento de contexto estrito e exposição de API segura para o Renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // Window Controls
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:closeApp'),
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
