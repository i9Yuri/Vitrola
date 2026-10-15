/**
 * VITROLA - COMPONENTE STATUS BAR (StatusBar.js)
 * Barra inferior de status (32px): telemetria do motor yt-dlp/ffmpeg e versao do aplicativo.
 */

export class StatusBar {
  constructor(options = {}) {
    this.container = null;
    this.engineDot = null;
    this.engineText = null;
    this.versionText = null;
  }

  mount(container = document.querySelector(".foot")) {
    if (!container) return;
    this.container = container;
    this.engineDot = container.querySelector("#status-engine-dot");
    this.engineText = container.querySelector("#status-engine-text");
    this.versionText = container.querySelector("#status-version");
  }

  setEngineStatus(status, text) {
    if (this.engineText) {
      this.engineText.textContent = text || "yt-dlp e ffmpeg prontos";
    }
    if (this.engineDot) {
      this.engineDot.className = "";
      if (status === "checking" || status === "updating" || status === "available") {
        this.engineDot.classList.add("warn");
      } else if (status === "error" || status === "offline") {
        this.engineDot.classList.add("err");
      }
    }
  }

  setVersion(version) {
    if (this.versionText) {
      this.versionText.textContent = version || "Vitrola v2.3.0";
    }
  }
}
