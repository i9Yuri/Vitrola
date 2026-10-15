/**
 * FITA / MEDIAFORGE - CONTROLE DE JANELA NATIVA (window-controls.js)
 * Manipulação de minimizar, maximizar/restaurar e fechar via processo nativo/API.
 */

export async function minimizeWindow() {
  if (window.electronAPI?.windowAction) {
    return await window.electronAPI.windowAction("minimize");
  }
  try {
    const res = await fetch("/api/window/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "minimize" }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function maximizeWindow() {
  if (window.electronAPI?.windowAction) {
    return await window.electronAPI.windowAction("maximize");
  }
  try {
    const res = await fetch("/api/window/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "maximize" }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function closeWindow() {
  if (window.electronAPI?.windowAction) {
    return await window.electronAPI.windowAction("close");
  }
  try {
    const res = await fetch("/api/window/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    return await res.json();
  } catch (err) {
    window.close();
    return { success: true };
  }
}
