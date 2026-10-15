/**
 * VITROLA - COMPONENTE MEDIA SEARCH CARD (MediaSearchCard.js)
 * Card de resultado com mockup estilizado de vinil saindo da capa (.sleeve + .rec),
 * alternador segmentado (Áudio / Vídeo), chips de formato/qualidade (sem FLAC) e estimativa de tamanho.
 */

export class MediaSearchCard {
  constructor(options = {}) {
    this.onModeChange = options.onModeChange || (() => {});
    this.onFormatChange = options.onFormatChange || (() => {});
    this.onQualityChange = options.onQualityChange || (() => {});
    this.onStartDownload = options.onStartDownload || (() => {});
    this.card = null;
    this.thumbEl = null;
    this.durEl = null;
    this.titleEl = null;
    this.byEl = null;
    this.statsEl = null;
    this.destEl = null;
  }

  mount(cardElement = document.getElementById("result-card")) {
    if (!cardElement) return;
    this.card = cardElement;
    this.thumbEl = cardElement.querySelector("#card-thumb");
    this.durEl = cardElement.querySelector("#card-dur");
    this.titleEl = cardElement.querySelector("#card-title");
    this.byEl = cardElement.querySelector("#card-by");
    this.statsEl = cardElement.querySelector("#card-stats");
    this.destEl = cardElement.querySelector("#dest-path");
  }

  show() {
    if (this.card) this.card.classList.remove("hidden");
  }

  hide() {
    if (this.card) this.card.classList.add("hidden");
  }

  setDestination(dir) {
    if (this.destEl) {
      const displayPath = (dir || "~/Música/Vitrola").replace(/\/home\/[^/]+/, "~");
      this.destEl.textContent = displayPath;
      this.destEl.title = dir;
    }
  }
}
