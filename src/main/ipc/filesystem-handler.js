/**
 * VITROLA - MANIPULADOR DE SISTEMA DE ARQUIVOS (filesystem-handler.js)
 * Verificação de existência, revelação no gerenciador e diálogo de seleção.
 */

export async function checkAndShowItem(filePath) {
  if (window.electronAPI?.checkAndShowItem) {
    return await window.electronAPI.checkAndShowItem(filePath);
  }
  try {
    const res = await fetch("/api/check-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    return await res.json();
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

export async function openDirectory(dirPath = null) {
  if (window.electronAPI?.openDirectory) {
    return await window.electronAPI.openDirectory(dirPath);
  }
  try {
    const res = await fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dirPath }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function selectDirectory(currentPath = null) {
  if (window.electronAPI?.selectDirectory) {
    return await window.electronAPI.selectDirectory(currentPath);
  }
  try {
    const res = await fetch("/api/select-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath }),
    });
    return await res.json();
  } catch (err) {
    return { canceled: true, error: err.message };
  }
}
