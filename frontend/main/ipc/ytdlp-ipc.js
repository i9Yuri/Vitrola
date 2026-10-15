/**
 * VITROLA - MANIPULADOR IPC / API YT-DLP (ytdlp-ipc.js)
 * Manipuladores para checagem de versão e execução remota/local de auto-update.
 */

export async function checkYtDlpStatus() {
  try {
    const res = await fetch('/api/updater/status');
    const data = await res.json();
    if (data.success && data.updater) {
      return {
        version: data.updater.current_version || 'desconhecida',
        latestVersion: data.updater.latest_version,
        isUpToDate: !data.updater.update_available,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (err) {
    return {
      version: 'desconhecida',
      isUpToDate: false,
      lastChecked: new Date().toISOString(),
    };
  }
}

export async function executeYtDlpUpdate() {
  try {
    const res = await fetch('/api/updater/update', { method: 'POST' });
    const data = await res.json();
    return {
      success: Boolean(data.success),
      newVersion: data.updater?.current_version,
      error: data.error,
      outputLog: data.output || data.message,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
