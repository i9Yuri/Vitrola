/**
 * VITROLA - ELECTRON MAIN PROCESS (main.js)
 * Bootstrap defensivo, telemetria de inicialização, mitigação de falhas de GPU no Linux
 * e ciclo de vida de janela frameless.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const child_process = require('child_process');
const { getStorageTelemetry } = require('./ipc/storage-telemetry');
const { readClipboardText, registerClipboardHandlers } = require('./ipc/clipboard-handler');
const { registerDownloadHandlers } = require('./ipc/download-handler');

const DIAGNOSTICS_DIR = path.join(__dirname, '../../_dev/diagnostics');
const LOG_FILE = path.join(DIAGNOSTICS_DIR, 'boot.log');

/**
 * Contrato de Registro de Falhas (Diagnostics Logger)
 */
function logStartupDiagnostic(stage, errorDetails = {}) {
  const timestamp = new Date().toISOString();
  const msg = errorDetails.message || 'Erro não especificado';
  const stack = errorDetails.stack || '';
  const code = errorDetails.code !== undefined ? ` [Code: ${errorDetails.code}]` : '';

  const logLine = `[${timestamp}][${stage}]${code} ${msg}${stack ? '\n' + stack : ''}\n`;

  // Output no terminal com destaque
  console.error(`\x1b[31m[BOOT-DIAGNOSTIC][${stage}]\x1b[0m ${msg}${code}`);
  if (stack) {
    console.error(`\x1b[33m${stack}\x1b[0m`);
  }

  try {
    if (!fs.existsSync(DIAGNOSTICS_DIR)) {
      fs.mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (fsErr) {
    console.error('[BOOT-LOG] Falha ao persistir log em disco:', fsErr.message);
  }
}

// 1. Interceptação global preventiva de exceções síncronas e assíncronas
process.on('uncaughtException', (err, origin) => {
  logStartupDiagnostic('uncaughtException', {
    message: err ? err.message : 'Exceção não tratada capturada',
    stack: err ? err.stack : undefined,
    origin: String(origin)
  });
});

process.on('unhandledRejection', (reason) => {
  logStartupDiagnostic('unhandledRejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

let electron = null;
try {
  electron = require('electron');
} catch (e) {
  // Execução fora do runtime do Electron (ex: Node unit tests / backend)
}

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

/**
 * Contrato de Resolução de Caminhos Dinâmicos
 * getExecutableResourcePath(relativePath: string) -> string
 * Em ambiente empacotado, mapeia a partir de process.resourcesPath.
 * Em desenvolvimento, mapeia a partir da raiz da aplicação (app.getAppPath()).
 */
function getExecutableResourcePath(relativePath = '') {
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  const appPath = (app && typeof app.getAppPath === 'function')
    ? app.getAppPath()
    : path.resolve(__dirname, '../..');
  return path.join(appPath, relativePath);
}

/**
 * Garante permissões POSIX de execução (0755) para binários locais em runtime.
 */
function ensureBinaryPermissions(binDir) {
  if (!fs.existsSync(binDir)) return;
  const binaries = ['yt-dlp', 'ffmpeg', 'ffprobe'];
  for (const b of binaries) {
    const fullPath = path.join(binDir, b);
    if (fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        if ((stats.mode & 0o777) !== 0o755) {
          fs.chmodSync(fullPath, 0o755);
        }
      } catch (err) {
        console.warn(`[BOOT] Falha ao ajustar permissões de execução em ${fullPath}:`, err.message);
      }
    }
  }
}

/**
 * Recupera o caminho de downloads configurado pelo usuário com expansão de ~
 */
function getConfiguredDownloadPath() {
  try {
    const userCfgPath = path.join(os.homedir(), '.config/vitrola/config.json');
    const localCfgPath = getExecutableResourcePath('config/config.json');
    const cfgPath = fs.existsSync(userCfgPath) ? userCfgPath : localCfgPath;

    if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.storage && parsed.storage.download_dir) {
        let dir = parsed.storage.download_dir;
        if (dir.startsWith('~')) {
          dir = path.join(os.homedir(), dir.slice(1));
        }
        return path.resolve(dir);
      }
    }
  } catch (err) {
    console.warn('[Storage] Falha ao ler configuração de downloads:', err.message);
  }
  return getDefaultDownloadPath();
}

/**
 * Orquestração do Backend Python em Subprocesso
 */
let backendProcess = null;
let backendPort = 8765;
let backendHost = '127.0.0.1';

/**
 * Contrato de Inicialização do Subprocesso:
 * spawnBackendService(backendEntrypoint: string, envOverrides: Record<string, string>) -> ChildProcess
 */
function spawnBackendService(backendEntrypoint, envOverrides = {}) {
  const binDir = getExecutableResourcePath('bin');
  ensureBinaryPermissions(binDir);

  const env = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH || ''}`,
    PYTHONUNBUFFERED: '1',
    ...envOverrides
  };

  const pythonExec = process.env.PYTHON || 'python3';
  const projectRoot = getExecutableResourcePath('');

  console.log(`\x1b[34m[BACKEND] Inicializando serviço Python: ${pythonExec} ${backendEntrypoint} --headless\x1b[0m`);
  console.log(`\x1b[34m[BACKEND] Diretório de binários ativos: ${binDir}\x1b[0m`);

  const proc = child_process.spawn(pythonExec, [backendEntrypoint, '--headless'], {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  activeProcessesPool.add(proc);

  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    console.log(`[BACKEND-STDOUT] ${text.trim()}`);
    const match = text.match(/http:\/\/([a-zA-Z0-9.]+):(\d+)/);
    if (match) {
      backendHost = match[1];
      backendPort = parseInt(match[2], 10);
      console.log(`\x1b[32m[BACKEND] Host/porta detectados via telemetria: ${backendHost}:${backendPort}\x1b[0m`);
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    console.error(`[BACKEND-STDERR] ${text.trim()}`);
  });

  proc.on('error', (err) => {
    logStartupDiagnostic('backend-process-error', { message: err.message, stack: err.stack });
    console.error('\x1b[31m[BACKEND] Erro crítico no processo filho:\x1b[0m', err.message);
  });

  proc.on('close', (code, signal) => {
    console.log(`[BACKEND] Processo filho finalizado com código ${code}, sinal ${signal}`);
    activeProcessesPool.delete(proc);
    if (backendProcess === proc) {
      backendProcess = null;
    }
  });

  return proc;
}

/**
 * Aguarda a prontidão do servidor HTTP do backend antes de liberar requisições
 */
async function waitForBackendReadiness(host, port, maxRetries = 25, delayMs = 200) {
  const http = require('http');
  const url = `http://${host}:${port}/api/config`;

  for (let i = 0; i < maxRetries; i++) {
    const isReady = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      console.log(`\x1b[32m[BACKEND] Servidor HTTP pronto e respondendo em http://${host}:${port} após ${i * delayMs}ms\x1b[0m`);
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  console.warn(`\x1b[33m[BACKEND] Timeout aguardando prontidão do servidor HTTP em http://${host}:${port}. Prosseguindo com o bootstrap...\x1b[0m`);
  return false;
}

/**
 * Encerramento seguro (graceful shutdown) do subprocesso Python
 */
function terminateBackendService() {
  if (backendProcess && !backendProcess.killed) {
    console.log('\x1b[33m[LIFECYCLE] Encerrando backend Python com segurança (SIGTERM)...\x1b[0m');
    try {
      backendProcess.kill('SIGTERM');
      const procRef = backendProcess;
      setTimeout(() => {
        if (procRef && !procRef.killed) {
          try {
            console.log('\x1b[33m[LIFECYCLE] Forçando terminação do backend (SIGKILL)...\x1b[0m');
            procRef.kill('SIGKILL');
          } catch (_) {}
        }
      }, 1500);
    } catch (e) {
      console.warn('[LIFECYCLE] Falha ao enviar sinal de término ao backend:', e.message);
    }
  }
}

// 2. Flags de Compatibilidade Gráfica e Compositores Linux (Wayland / X11)
if (app) {
  // Prevenção de suspensão de renderização e descarte de contexto gráfico
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

  if (process.platform === 'linux') {
    try {
      app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
      app.commandLine.appendSwitch('disable-gpu-sandbox');
      app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');

      // Permitir desativação de hardware acceleration via variável de ambiente
      if (process.env.VITROLA_DISABLE_GPU === '1' || process.env.LIBGL_ALWAYS_SOFTWARE === '1') {
        app.disableHardwareAcceleration();
        console.log('\x1b[33m[BOOT] Aceleração gráfica por hardware desativada por configuração.\x1b[0m');
      }
    } catch (switchErr) {
      logStartupDiagnostic('gpu-switch-init', { message: switchErr.message });
    }
  }
}

/**
 * Pool de subprocessos ativos e Controlador de Ciclo de Vida da Janela
 */
const activeProcessesPool = new Set();

const windowController = {
  minimizeWindow(win) {
    if (!win || (win.isDestroyed && win.isDestroyed())) return;
    setImmediate(() => {
      try {
        if (win && !win.isDestroyed()) {
          win.minimize();
        }
      } catch (err) {
        logStartupDiagnostic('windowController:minimizeWindow', { message: err.message });
      }
    });
  },

  forceTeardown(win) {
    console.log('\x1b[33m[LIFECYCLE] Executando forceTeardown imediato (SIGKILL + destroy + exit)...\x1b[0m');
    // a) Enviar sinal SIGKILL imediato para todos os processos filhos de yt-dlp/ffmpeg
    try {
      for (const proc of activeProcessesPool) {
        if (proc && !proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch (_) {}
        }
      }
      activeProcessesPool.clear();
    } catch (poolErr) {
      logStartupDiagnostic('forceTeardown:procPool', { message: poolErr.message });
    }

    // b) Limpar listeners da janela para eliminar qualquer deadlock no evento 'close'
    try {
      if (win && !win.isDestroyed()) {
        win.removeAllListeners('close');
        win.removeAllListeners();
      }
      if (ipcMain) {
        ipcMain.removeAllListeners();
      }
    } catch (listenerErr) {
      logStartupDiagnostic('forceTeardown:removeListeners', { message: listenerErr.message });
    }

    // c) Destruir instantaneamente o contexto nativo da janela (< 100ms)
    try {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    } catch (_) {}

    // d) Chamar app.exit(0) na linha imediatamente seguinte
    if (app) {
      try {
        app.exit(0);
      } catch (_) {
        process.exit(0);
      }
    } else {
      process.exit(0);
    }
  },

  terminateAppGracefully(win) {
    this.forceTeardown(win);
  }
};

/**
 * Contrato de Verificação de Bootstrap (Main Process)
 * validateStartupPrerequisites(): Promise<{ isValid: boolean, missingAssets: string[], resolvedEntryPath: string }>
 */
async function validateStartupPrerequisites() {
  const resolvedEntryPath = path.resolve(__dirname, '../renderer/index.html');
  const preloadScriptPath = path.resolve(__dirname, 'preload.js');
  const mainCssPath = path.resolve(__dirname, '../renderer/styles/main.css');

  const missingAssets = [];

  if (!fs.existsSync(resolvedEntryPath)) missingAssets.push(`HTML: ${resolvedEntryPath}`);
  if (!fs.existsSync(preloadScriptPath)) missingAssets.push(`Preload: ${preloadScriptPath}`);
  if (!fs.existsSync(mainCssPath)) missingAssets.push(`CSS: ${mainCssPath}`);

  const isValid = missingAssets.length === 0;

  if (!isValid) {
    logStartupDiagnostic('validateStartupPrerequisites', {
      message: `Ativos críticos ausentes: ${missingAssets.join(', ')}`
    });
  } else {
    console.log('\x1b[32m[BOOT] Pré-requisitos de inicialização validados com sucesso.\x1b[0m');
  }

  return { isValid, missingAssets, resolvedEntryPath };
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

  // system:open-download-folder
  ipcMain.handle('system:open-download-folder', async () => {
    try {
      const folderPath = getConfiguredDownloadPath();
      const resolved = path.resolve(folderPath);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }
      const openResult = await shell.openPath(resolved);
      if (openResult) {
        return { success: false, error: openResult };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // system:getBackendInfo
  ipcMain.handle('system:getBackendInfo', async () => {
    return {
      host: backendHost,
      port: backendPort,
      url: `http://${backendHost}:${backendPort}`
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

  // storage:getDirectoryTelemetry
  ipcMain.handle('storage:getDirectoryTelemetry', async (event, customPath) => {
    const dir = customPath || getDefaultDownloadPath();
    return await getStorageTelemetry(dir);
  });

  // settings:getDownloadPath
  ipcMain.handle('settings:getDownloadPath', async () => {
    return getDefaultDownloadPath();
  });

  // settings:changeDownloadPath
  ipcMain.handle('settings:changeDownloadPath', async (event, currentPath) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Vitrola — Selecionar pasta de destino',
        defaultPath: currentPath || getDefaultDownloadPath(),
        properties: ['openDirectory', 'createDirectory']
      });
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        return { canceled: false, newPath: result.filePaths[0] };
      }
      return { canceled: true };
    } catch (err) {
      return { canceled: true, error: err.message };
    }
  });

  // clipboard:readText & clipboard:read-text
  registerClipboardHandlers(ipcMain);

  // settings:revealDownloadPath
  ipcMain.handle('settings:revealDownloadPath', async (event, targetPath) => {
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

  // window controls IPC
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) windowController.minimizeWindow(win);
  });

  ipcMain.handle('window:minimize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) windowController.minimizeWindow(win);
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

  ipcMain.on('window:forceClose', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    windowController.forceTeardown(win);
  });

  ipcMain.handle('window:forceClose', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    windowController.forceTeardown(win);
    return { success: true, action: 'forceClose' };
  });

  ipcMain.handle('window:closeApp', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) windowController.terminateAppGracefully(win);
    return { success: true, action: 'close' };
  });

  ipcMain.handle('window:action', async (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Janela não encontrada' };
    if (action === 'minimize') {
      windowController.minimizeWindow(win);
      return { success: true, action: 'minimize' };
    } else if (action === 'maximize') {
      if (win.isMaximized()) {
        win.unmaximize();
        return { success: true, isMaximized: false };
      } else {
        win.maximize();
        return { success: true, isMaximized: true };
      }
    } else if (action === 'close' || action === 'force_close') {
      windowController.forceTeardown(win);
      return { success: true, action: 'close' };
    } else if (action === 'start_drag') {
      return { success: true, action: 'start_drag' };
    }
    return { success: false, error: `Ação desconhecida: ${action}` };
  });

  // Registra handlers do subsistema de download (retry & error details)
  registerDownloadHandlers(ipcMain);

  // History operations dispatched to backend
  ipcMain.handle('history:getAggregated', async () => {
    try {
      const res = await fetch(`http://${backendHost}:${backendPort}/api/history`);
      const data = await res.json();
      return data.history || [];
    } catch (e) {
      console.error('[IPC history:getAggregated] Erro ao obter histórico:', e.message);
      return [];
    }
  });
  ipcMain.handle('history:deleteItem', async (event, mediaKey) => {
    try {
      const res = await fetch(`http://${backendHost}:${backendPort}/api/history/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_key: mediaKey })
      });
      return await res.json();
    } catch (e) {
      console.error('[IPC history:deleteItem] Erro ao deletar item:', e.message);
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('history:clearAll', async () => {
    try {
      const res = await fetch(`http://${backendHost}:${backendPort}/api/history/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      });
      return await res.json();
    } catch (e) {
      console.error('[IPC history:clearAll] Erro ao limpar histórico:', e.message);
      return { success: false, error: e.message };
    }
  });
}

/**
 * Contrato de Configuração de Janela Defensiva
 * createSecureMainWindow(options: BrowserWindowInitOptions): BrowserWindow
 * Schema: { entryHtmlPath, preloadScriptPath, isDevMode, disableGpu, themeBgColor }
 */
function createSecureMainWindow(options = {}) {
  if (!BrowserWindow) return null;

  const entryHtmlPath = options.entryHtmlPath || path.resolve(__dirname, '../renderer/index.html');
  const preloadScriptPath = options.preloadScriptPath || path.resolve(__dirname, 'preload.js');
  const themeBgColor = options.themeBgColor || '#081017';
  const isDevMode = options.isDevMode !== undefined ? options.isDevMode : (!app.isPackaged || process.env.NODE_ENV === 'development');

  console.log('\x1b[34m[BOOT] Instanciando BrowserWindow defensiva...\x1b[0m');

  const win = new BrowserWindow({
    title: APP_CONFIG.NAME,
    width: 1200,
    height: 760,
    minWidth: 840,
    minHeight: 580,
    frame: false,
    show: false, // Exibição sob demanda: aguarda ready-to-show
    backgroundColor: themeBgColor,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: fs.existsSync(preloadScriptPath) ? preloadScriptPath : undefined,
      sandbox: false,
      webSecurity: true,
    }
  });

  if (win.setDesktopFileName) {
    win.setDesktopFileName('vitrola');
  }

  // 1. Sequenciamento de Exibição da Janela
  win.once('ready-to-show', () => {
    console.log('\x1b[32m[BOOT] Evento ready-to-show recebido. Exibindo janela.\x1b[0m');
    win.show();
    if (isDevMode) {
      try {
        win.webContents.openDevTools({ mode: 'detach' });
      } catch (devErr) {
        logStartupDiagnostic('openDevTools', { message: devErr.message });
      }
    }
  });

  // Interceptação de eventos para mitigar suspensão de GPU e context drop no Linux
  win.on('minimize', () => {
    try {
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('window:minimized-state', true);
      }
    } catch (_) {}
  });

  win.on('restore', () => {
    try {
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('window:minimized-state', false);
      }
    } catch (_) {}
  });

  // 2. Telemetria de Falhas no Ciclo de Vida do WebContents
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logStartupDiagnostic('did-fail-load', {
      message: `Falha ao carregar URL '${validatedURL}': ${errorDescription}`,
      code: errorCode
    });

    // Contingência: renderiza página de erro local explicativa
    const contingencyHtml = `
      <!doctype html>
      <html style="background:#181A21;color:#EFF0F5;font-family:sans-serif;padding:32px;">
      <head><meta charset="utf-8"><title>Vitrola - Erro de Carregamento</title></head>
      <body>
        <h2 style="color:#D9484F;">Falha no Carregamento do Vitrola</h2>
        <p>Não foi possível carregar a interface da aplicação.</p>
        <div style="background:#1F222B;padding:16px;border-radius:8px;font-family:monospace;margin:16px 0;">
          <div><b>Código de Erro:</b> ${errorCode}</div>
          <div><b>Descrição:</b> ${errorDescription}</div>
          <div><b>URL:</b> ${validatedURL}</div>
        </div>
        <p>Verifique o arquivo de log em <code>_dev/diagnostics/boot.log</code> para detalhes adicionais.</p>
      </body>
      </html>
    `;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contingencyHtml)}`);
  });

  win.webContents.on('render-process-gone', (event, details) => {
    logStartupDiagnostic('render-process-gone', {
      message: `Processo de renderização encerrado inesperadamente. Motivo: ${details.reason}`,
      code: details.exitCode
    });
  });

  win.webContents.on('crashed', (event, killed) => {
    logStartupDiagnostic('webContents-crashed', {
      message: `Processo de webContents crashou (Killed: ${killed})`
    });
  });

  // 3. Ingestão Segura do HTML
  if (fs.existsSync(entryHtmlPath)) {
    console.log(`\x1b[34m[BOOT] Carregando HTML: ${entryHtmlPath}\x1b[0m`);
    win.loadFile(entryHtmlPath).catch((err) => {
      logStartupDiagnostic('win.loadFile', { message: err.message, stack: err.stack });
    });
  } else {
    logStartupDiagnostic('entryHtmlNotFound', {
      message: `Arquivo HTML não encontrado em ${entryHtmlPath}`
    });
    const missingHtml = `
      <!doctype html>
      <html style="background:#181A21;color:#EFF0F5;font-family:sans-serif;padding:32px;">
      <head><meta charset="utf-8"><title>Vitrola - Erro</title></head>
      <body>
        <h2 style="color:#D9484F;">Arquivo de Interface Não Encontrado</h2>
        <p>O arquivo principal de renderização não existe no caminho esperado:</p>
        <code style="background:#1F222B;padding:8px 12px;display:block;border-radius:6px;margin:12px 0;">${entryHtmlPath}</code>
      </body>
      </html>
    `;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(missingHtml)}`);
    win.show();
  }

  return win;
}

/**
 * Inicialização acelerada da janela principal (Zero-Wait Bootstrap).
 * Pré-aloca a BrowserWindow com show: false e background sóbrio nativo (#081017),
 * suprime I/O bloqueante antes do primeiro frame e agenda microtasks diferidas
 * após a emissão de ready-to-show e exibição da janela.
 * @returns {Promise<BrowserWindow>}
 */
async function bootstrapOptimizedWindow() {
  const prereqs = await validateStartupPrerequisites();
  registerIpcHandlers();

  const win = createSecureMainWindow({
    entryHtmlPath: prereqs.resolvedEntryPath,
    preloadScriptPath: path.resolve(__dirname, 'preload.js'),
    themeBgColor: '#081017',
    isDevMode: !app.isPackaged || process.env.NODE_ENV === 'development'
  });

  // Microtasks diferidas pós-renderização: executadas estritamente após ready-to-show
  if (win) {
    win.once('ready-to-show', () => {
      setImmediate(() => {
        try {
          // Pré-aquecimento não-bloqueante de telemetria de armazenamento
          getStorageTelemetry().catch(() => {});
        } catch (_) {}
      });
    });
  }

  return win;
}

let mainWindow = null;
let isBootstrapReady = false;

if (app) {
  app.setName('Vitrola');

  // Proteção defensiva para userData caso ~/.config seja somente leitura
  try {
    const defaultUserData = app.getPath('userData');
    if (!fs.existsSync(defaultUserData)) {
      fs.mkdirSync(defaultUserData, { recursive: true });
    }
  } catch (userDataErr) {
    try {
      const fallbackDir = path.join(os.tmpdir(), 'vitrola-userdata');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      app.setPath('userData', fallbackDir);
    } catch (_) {}
  }

  // Controle de Instância Única (Single Instance Lock)
  let gotTheLock = false;
  try {
    gotTheLock = app.requestSingleInstanceLock();
  } catch (_) {
    gotTheLock = true;
  }
  if (!gotTheLock) {
    console.log('\x1b[33m[BOOT] Instância prévia do Vitrola já está ativa. Encerrando segunda chamada...\x1b[0m');
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(async () => {
      console.log('\x1b[32m[BOOT] Electron app.whenReady disparado. Inicializando serviços...\x1b[0m');

      // 1. Inicializar processo filho do backend Python e binários empacotados
      try {
        const backendEntrypoint = getExecutableResourcePath('backend/main.py');
        backendProcess = spawnBackendService(backendEntrypoint);
        await waitForBackendReadiness(backendHost, backendPort);
      } catch (backendErr) {
        logStartupDiagnostic('spawnBackendService', { message: backendErr.message, stack: backendErr.stack });
      }

      mainWindow = await bootstrapOptimizedWindow();
      isBootstrapReady = true;

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          mainWindow = await bootstrapOptimizedWindow();
        }
      });
    }).catch((readyErr) => {
      logStartupDiagnostic('app.whenReady', { message: readyErr.message, stack: readyErr.stack });
    });

    app.on('before-quit', () => {
      terminateBackendService();
    });

    app.on('will-quit', () => {
      terminateBackendService();
    });

    app.on('window-all-closed', () => {
      // Se a janela fechou antes do bootstrap terminar, não finalizar de imediato em modo debug
      if (!isBootstrapReady) {
        logStartupDiagnostic('early-window-closed', { message: 'Janela fechada antes da conclusão do bootstrap.' });
      }
      terminateBackendService();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
}

module.exports = {
  APP_CONFIG,
  getDefaultDownloadPath,
  getConfiguredDownloadPath,
  getExecutableResourcePath,
  spawnBackendService,
  waitForBackendReadiness,
  terminateBackendService,
  registerIpcHandlers,
  logStartupDiagnostic,
  validateStartupPrerequisites,
  createSecureMainWindow,
  bootstrapOptimizedWindow,
  windowController,
  activeProcessesPool
};
