/**
 * MARÉ - COMPONENTE SETTINGS MODAL (SettingsModal.js)
 * Painel de Ajustes de tema (Claro, Slate, AMOLED), acentos e governança yt-dlp.
 */

import { themeManager } from "../js/theme-manager.js";
import { ytdlpManager } from "../js/ytdlp-manager.js";

export class SettingsModal {
  constructor(modalElement = document.getElementById("modal-settings")) {
    this.modal = modalElement;
  }

  open() {
    if (this.modal) this.modal.classList.add("active");
  }

  close() {
    if (this.modal) this.modal.classList.remove("active");
  }
}
