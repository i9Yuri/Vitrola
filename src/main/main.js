/**
 * VITROLA - ELECTRON MAIN PROCESS (main.js)
 * Configurações de janela frameless nativa, controles IPC e integração com SO.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

let electron = null;
try {
  electron = require('electron');
} catch (_) {}

const { app, BrowserWindow, ipcMain, dialog, shell } = electron || {};

const APP_CONFIG = {
  NAME: 'Vitrola',
  SLUG: 'vitrola',
  REPOSITORY: 'https://github.com/i9Yuri/Vitrola',
  DEFAULT_DOWNLOAD_DIR: 'Vitrola',
  VERSION: '2.3.0'
};

function getDefaultDownloadPath() {
  const musicDir = path.join(os.homedir(), 'Música', APP_CONFIG.DEFAULT_DOWNLOAD_DIR);
  if (fs.existsSync(musicDir)) return musicDir;
  return path.join(os.homedir(), 'Downloads', APP_CONFIG.DEFAULT_DOWNLOAD_DIR);
}

function registerIpcHandlers() {
  if (!ipcMain) return;

  // system:getAppMetadata
  ipcMain.handle('system:getAppMetadata', async () => {
    return {
      name: APP_CONFIG.NAME,
      version: APP_CONFIG.VERSION,
      repoUrl: APP_CONFIG.REPOSITORY,
      isFrameless: true
    };
  });

  // storage:getDefaultDirectory
  ipcMain.handle('storage:getDefaultDirectory', async () => {
    return getDefaultDownloadPath();
  });

  // storage:openTargetDirectory
  ipcMain.handle('storage:openTargetDirectory', async (event, targetPath) => {
    const dirToOpen = targetPath || getDefaultDownloadPath();
    try {
      if (!fs.existsSync(dirToOpen)) {
        fs.mkdirSync(dirToOpen, { recursive: true });
      }
      await shell.openPath(dirToOpen);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // storage:updateTargetDirectory
  ipcMain.handle('storage:updateTargetDirectory', async (event, currentPath) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Vitrola — Selecionar pasta de destino',
        defaultPath: currentPath || getDefaultDownloadPath(),
        properties: ['openDirectory', 'createDirectory']
      });
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        return { success: true, path: result.filePaths[0] };
      }
      return { success: false, canceled: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // window controls IPC
  ipcMain.handle('window:minimize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
    return { success: true, action: 'minimize' };
  });

  ipcMain.handle('window:toggleMaximize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
        return { success: true, isMaximized: false };
      } else {
        win.maximize();
        return { success: true, isMaximized: true };
      }
    }
    return { success: false };
  });

  ipcMain.handle('window:closeApp', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
    return { success: true, action: 'close' };
  });

  ipcMain.handle('window:action', async (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Janela não encontrada' };
    if (action === 'minimize') {
      win.minimize();
      return { success: true, action: 'minimize' };
    } else if (action === 'maximize') {
      if (win.isMaximized()) {
        win.unmaximize();
        return { success: true, isMaximized: false };
      } else {
        win.maximize();
        return { success: true, isMaximized: true };
      }
    } else if (action === 'close') {
      win.close();
      return { success: true, action: 'close' };
    }
    return { success: false, error: `Ação desconhecida: ${action}` };
  });
}

function createWindow() {
  if (!BrowserWindow) return null;

  const win = new BrowserWindow({
    title: APP_CONFIG.NAME,
    width: 1200,
    height: 760,
    minWidth: 840,
    minHeight: 580,
    frame: false,
    backgroundColor: '#181A21',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // desktopName for Wayland / X11 taskbars
  if (win.setDesktopFileName) {
    win.setDesktopFileName('vitrola.desktop');
  }

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

if (app) {
  app.setName('Vitrola');

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = {
  APP_CONFIG,
  getDefaultDownloadPath,
  registerIpcHandlers
};
