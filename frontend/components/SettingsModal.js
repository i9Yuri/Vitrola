/**
 * VITROLA - COMPONENTE SETTINGS MODAL (SettingsModal.js)
 * Painel de Ajustes: Temas, Cores de Acento, Armazenamento & Destino e Governança yt-dlp.
 */

import { themeManager } from "../js/theme-manager.js";
import { ytdlpManager } from "../js/ytdlp-manager.js";

export class SettingsModal {
  constructor(options = {}) {
    this.modal = options.modalElement || document.getElementById("modal-settings");
    this.onDestinationChanged = options.onDestinationChanged || (() => {});
    this.onToast = options.onToast || (() => {});
    this.themeBtns = [];
    this.accentBtns = [];
    this.destPathEl = null;
    this.btnChangeDest = null;
    this.btnRevealDest = null;
    this.init();
  }

  init() {
    if (!this.modal) return;
    this.themeBtns = this.modal.querySelectorAll(".theme-btn");
    this.accentBtns = this.modal.querySelectorAll(".accent-btn");
    this.destPathEl = this.modal.querySelector("#settings-dest-path");
    this.btnChangeDest = this.modal.querySelector("#btn-settings-change-dest");
    this.btnRevealDest = this.modal.querySelector("#btn-settings-reveal-dest");

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

    if (this.btnChangeDest) {
      this.btnChangeDest.addEventListener("click", () => this.handleChangeDestination());
    }

    if (this.btnRevealDest) {
      this.btnRevealDest.addEventListener("click", () => this.handleRevealDestination());
    }

    window.addEventListener("themechange", () => this.syncUI());
    this.syncUI();
  }

  setDestinationPath(path) {
    if (this.destPathEl) {
      this.destPathEl.textContent = path || "~/Música/Vitrola";
      this.destPathEl.title = path || "";
    }
  }

  async handleChangeDestination() {
    try {
      if (window.electronAPI && typeof window.electronAPI.changeDownloadPath === "function") {
        const res = await window.electronAPI.changeDownloadPath();
        if (res && !res.canceled && (res.path || res.selectedPath)) {
          const newPath = res.path || res.selectedPath;
          this.setDestinationPath(newPath);
          this.onDestinationChanged(newPath);
          this.onToast(`Pasta de destino alterada: ${newPath}`, "success");
        }
      } else {
        // Fallback HTTP runner
        const res = await fetch("/api/select-folder", { method: "POST" });
        const data = await res.json();
        if (data.success && data.path) {
          this.setDestinationPath(data.path);
          this.onDestinationChanged(data.path);
          this.onToast(`Pasta de destino alterada: ${data.path}`, "success");
        }
      }
    } catch (err) {
      console.warn("[Settings] Erro ao alterar pasta:", err);
      this.onToast("Falha ao selecionar pasta de destino", "error");
    }
  }

  async handleRevealDestination() {
    try {
      if (window.electronAPI && typeof window.electronAPI.revealDownloadPath === "function") {
        await window.electronAPI.revealDownloadPath();
        this.onToast("Pasta aberta no gerenciador de arquivos", "success");
      } else {
        const res = await fetch("/api/open-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success) {
          this.onToast("Pasta aberta no gerenciador de arquivos", "success");
        } else {
          this.onToast(data.error || "Não foi possível abrir a pasta", "warning");
        }
      }
    } catch (err) {
      console.warn("[Settings] Erro ao abrir pasta:", err);
      this.onToast("Erro ao abrir pasta", "error");
    }
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
