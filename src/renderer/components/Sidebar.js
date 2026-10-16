/**
 * VITROLA - COMPONENTE SIDEBAR (Sidebar.js)
 * Navegacao enxuta (Início, Histórico, Ajustes) e widget de telemetria de disco.
 */

export class Sidebar {
  constructor(options = {}) {
    this.onViewChange = options.onViewChange || (() => {});
    this.container = null;
    this.diskSize = null;
    this.diskMeter = null;
    this.diskAudioCount = null;
    this.diskVideoCount = null;
    this.diskLabel = null;
  }

  mount(container = document.querySelector(".side") || document.querySelector(".sidebar")) {
    if (!container) return;
    this.container = container;
    this.diskSize = container.querySelector("#disk-total-size");
    this.diskMeter = container.querySelector("#disk-meter-fill");
    this.diskAudioCount = container.querySelector("#disk-audio-count");
    this.diskVideoCount = container.querySelector("#disk-video-count");
    this.diskLabel = container.querySelector("#disk-label");

    const navButtons = container.querySelectorAll("nav a, nav button");
    navButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const view = btn.dataset.view;
        this.setActiveView(view);
        this.onViewChange(view);
      });
    });

    // Acionamento nativo da pasta de downloads ao clicar no card de status
    const diskWidget = container.querySelector("#disk-widget") || container.querySelector(".disk");
    if (diskWidget) {
      diskWidget.setAttribute("title", "Abrir pasta de downloads");
      diskWidget.addEventListener("click", async () => {
        try {
          if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === "function") {
            await window.electronAPI.openDownloadFolder();
          } else {
            await fetch("/api/open-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
          }
        } catch (err) {
          console.warn("[Sidebar] Falha ao abrir pasta de downloads:", err);
        }
      });
    }
  }

  setActiveView(view) {
    if (!this.container) return;
    const navButtons = this.container.querySelectorAll("nav a, nav button");
    navButtons.forEach((b) => {
      const isMatch = b.dataset.view === view;
      b.classList.toggle("on", isMatch);
      if (isMatch) {
        b.setAttribute("aria-current", "page");
      } else {
        b.removeAttribute("aria-current");
      }
    });
  }

  updateTelemetry(data = {}) {
    if (!data) return;
    if (this.diskSize && data.totalSizeFormatted) {
      this.diskSize.textContent = data.totalSizeFormatted;
    }
    if (this.diskAudioCount && typeof data.audioCount === "number") {
      this.diskAudioCount.textContent = `${data.audioCount} faixa${data.audioCount === 1 ? "" : "s"}`;
    }
    if (this.diskVideoCount && typeof data.videoCount === "number") {
      this.diskVideoCount.textContent = `${data.videoCount} vídeo${data.videoCount === 1 ? "" : "s"}`;
    }
    if (this.diskMeter && typeof data.usagePercent === "number") {
      const pct = Math.max(0, Math.min(100, data.usagePercent));
      this.diskMeter.style.width = `${pct}%`;
    }
  }
}
