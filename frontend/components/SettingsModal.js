/**
 * VITROLA - COMPONENTE SETTINGS MODAL (SettingsModal.js)
 * Painel de Ajustes de tema (Claro, Slate, AMOLED), acentos e governança yt-dlp.
 */

import { themeManager, themeEngine } from "../js/theme-manager.js";
import { ytdlpManager } from "../js/ytdlp-manager.js";

export class SettingsModal {
  constructor(modalElement = document.getElementById("modal-settings")) {
    this.modal = modalElement;
    this.themeBtns = [];
    this.accentBtns = [];
    this.init();
  }

  init() {
    if (!this.modal) return;
    this.themeBtns = this.modal.querySelectorAll(".theme-btn");
    this.accentBtns = this.modal.querySelectorAll(".accent-btn");

    this.themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        themeManager.setThemeMode(mode);
        this.syncUI();
      });
    });

    this.accentBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const color = btn.dataset.color;
        themeManager.setAccentColor(color);
        this.syncUI();
      });
    });

    window.addEventListener("themechange", () => this.syncUI());
    this.syncUI();
  }

  syncUI() {
    const prefs = themeManager.getPreferences();
    if (this.themeBtns && this.themeBtns.length > 0) {
      this.themeBtns.forEach((btn) => {
        const mode = btn.dataset.mode;
        const isActive =
          (mode === "dark-amoled" && (prefs.themeMode === "dark-amoled" || prefs.darkVariant === "amoled")) ||
          (mode === "light" && prefs.themeMode === "light") ||
          (mode === "dark" && prefs.themeMode === "dark" && prefs.darkVariant !== "amoled");
        btn.setAttribute("aria-checked", String(isActive));
      });
    }

    if (this.accentBtns && this.accentBtns.length > 0) {
      this.accentBtns.forEach((btn) => {
        const col = btn.dataset.color;
        const isActive = (prefs.accentColor || "default") === col;
        btn.setAttribute("aria-checked", String(isActive));
      });
    }
  }

  open() {
    if (this.modal) {
      this.syncUI();
      this.modal.classList.add("active");
    }
  }

  close() {
    if (this.modal) this.modal.classList.remove("active");
  }
}
