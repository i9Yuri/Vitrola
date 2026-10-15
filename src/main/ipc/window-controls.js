/**
 * VITROLA - CONTROLE DE JANELA NATIVA (window-controls.js)
 * Manipulação de minimizar, maximizar/restaurar e fechar via processo nativo/API.
 */

export async function minimizeWindow() {
  if (window.electronAPI) {
    if (typeof window.electronAPI.minimize === 'function') {
      window.electronAPI.minimize().catch(() => {});
      return { success: true, action: 'minimize' };
    }
    if (typeof window.electronAPI.windowAction === 'function') {
      window.electronAPI.windowAction('minimize').catch(() => {});
      return { success: true, action: 'minimize' };
    }
  }
  try {
    fetch("/api/window/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "minimize" }),
    }).catch(() => {});
    return { success: true, action: 'minimize' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function maximizeWindow() {
  if (window.electronAPI) {
    if (typeof window.electronAPI.maximize === 'function') {
      return await window.electronAPI.maximize();
    }
    if (typeof window.electronAPI.windowAction === 'function') {
      return await window.electronAPI.windowAction("maximize");
    }
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
  if (window.electronAPI) {
    if (typeof window.electronAPI.forceClose === 'function') {
      try { window.electronAPI.forceClose(); } catch (_) {}
      return { success: true, action: 'close' };
    }
    if (typeof window.electronAPI.close === 'function') {
      window.electronAPI.close().catch(() => {});
      return { success: true, action: 'close' };
    }
    if (typeof window.electronAPI.windowAction === 'function') {
      window.electronAPI.windowAction('close').catch(() => {});
      return { success: true, action: 'close' };
    }
  }
  try {
    fetch("/api/window/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    }).catch(() => {});
    setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 50);
    return { success: true, action: 'close' };
  } catch (err) {
    try { window.close(); } catch (_) {}
    return { success: true };
  }
}

export async function startWindowDrag() {
  if (window.electronAPI?.startWindowDrag) {
    return await window.electronAPI.startWindowDrag();
  }
  try {
    const res = await fetch("/api/window/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_drag" }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

