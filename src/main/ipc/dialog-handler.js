/**
 * VITROLA - MANIPULADOR DE DIÁLOGOS NATIVOS DO SO (dialog-handler.js)
 * Seleção de diretório nativo e revelação no gerenciador de arquivos (xdg-open / Dolphin / Nautilus).
 */

export async function openDirectory(path = null) {
  try {
    const res = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function selectDownloadDirectory() {
  try {
    const res = await fetch('/api/select-folder', { method: 'POST' });
    return await res.json();
  } catch (err) {
    return { canceled: true, error: err.message };
  }
}
