/**
 * VITROLA - COMPONENTE MEDIA SEARCH CARD (MediaSearchCard.js)
 * Card de resultado com mockup estilizado de vinil saindo da capa (.sleeve + .rec),
 * skeleton screen com shimmer horizontal neutro, seletor de qualidade original
 * e gerenciamento dos estados idle, fetching-skeleton e metadata-ready.
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
    this.platformEl = null;
    this.statsEl = null;
    this.destEl = null;
    this.groupAudioQ = null;
    this.groupVideoRes = null;
    this.state = "idle"; // idle | fetching-skeleton | metadata-ready | error
  }

  mount(cardElement = document.getElementById("result-card")) {
    if (!cardElement) return;
    this.card = cardElement;
    this.thumbEl = cardElement.querySelector("#card-thumb");
    this.durEl = cardElement.querySelector("#card-dur");
    this.titleEl = cardElement.querySelector("#card-title");
    this.byEl = cardElement.querySelector("#card-by");
    this.platformEl = cardElement.querySelector("#card-platform");
    this.statsEl = cardElement.querySelector("#card-stats");
    this.destEl = cardElement.querySelector("#dest-path");
    this.groupAudioQ = cardElement.querySelector("#group-audio-q");
    this.groupVideoRes = cardElement.querySelector("#group-video-res");
  }

  setState(state) {
    this.state = state;
    if (!this.card) return;

    if (state === "idle" || state === "error") {
      this.card.classList.add("hidden");
      this.card.classList.remove("fetching-skeleton", "metadata-ready");
    } else if (state === "fetching-skeleton") {
      this.card.classList.remove("hidden", "metadata-ready");
      this.card.classList.add("fetching-skeleton");
      if (this.thumbEl) {
        this.thumbEl.innerHTML = "";
      }
    } else if (state === "metadata-ready") {
      this.card.classList.remove("hidden", "fetching-skeleton");
      this.card.classList.add("metadata-ready");
    }
  }

  setOriginalMode(mode, isOriginal) {
    if (mode === "audio") {
      if (this.groupAudioQ) {
        this.groupAudioQ.classList.toggle("chips-disabled", isOriginal);
      }
    } else {
      if (this.groupVideoRes) {
        this.groupVideoRes.classList.toggle("chips-disabled", isOriginal);
      }
    }
  }

  setDestination(dir) {
    if (this.destEl) {
      const displayPath = (dir || "~/Música/Vitrola").replace(/\/home\/[^/]+/, "~");
      this.destEl.textContent = displayPath;
      this.destEl.title = dir;
    }
  }
}
