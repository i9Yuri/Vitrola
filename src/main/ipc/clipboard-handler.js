/**
 * VITROLA - MANIPULADOR DE ÁREA DE TRANSFERÊNCIA (clipboard-handler.js)
 * Leitura defensiva da área de transferência via electron.clipboard.
 */

let clipboard = null;
try {
  const electron = require("electron");
  clipboard = electron.clipboard;
} catch (e) {
  // Executando fora do runtime do Electron
}

async function readClipboardText() {
  try {
    if (clipboard && typeof clipboard.readText === "function") {
      return clipboard.readText();
    }
  } catch (err) {
    console.error("[Clipboard] Falha ao ler área de transferência:", err.message);
  }
  return "";
}

module.exports = {
  readClipboardText
};
