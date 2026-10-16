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
    this.audioOriginalBadge = null;
    this.audioOrigText = null;
    this.audioManualChips = null;
    this.videoOriginalBadge = null;
    this.videoOrigText = null;
    this.videoManualChips = null;
    this.currentData = null;
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
    this.audioOriginalBadge = cardElement.querySelector("#audio-original-badge");
    this.audioOrigText = cardElement.querySelector("#audio-orig-text");
    this.audioManualChips = cardElement.querySelector("#audio-manual-chips");
    this.videoOriginalBadge = cardElement.querySelector("#video-original-badge");
    this.videoOrigText = cardElement.querySelector("#video-orig-text");
    this.videoManualChips = cardElement.querySelector("#video-manual-chips");
  }

  applyState(state, data = null) {
    const s = String(state).toUpperCase();
    if (s === "HIDDEN" || s === "IDLE" || s === "EXTRACTION_ERROR" || s === "ERROR") {
      this.setState("idle");
    } else if (s === "SKELETON_LOADING" || s === "FETCHING-SKELETON" || s === "FETCHING_SKELETON" || s === "LOADING") {
      this.setState("fetching-skeleton");
    } else if (s === "METADATA_LOADED" || s === "METADATA-READY" || s === "METADATA_READY" || s === "READY") {
      this.setState("metadata-ready");
      if (data && typeof data === "object") {
        this.renderData(data);
      }
    }
  }

  renderData(data) {
    this.currentData = data;
    const meta = data.metadata || data;
    if (!meta) return;
    if (this.titleEl) this.titleEl.textContent = meta.title || "";
    if (this.byEl) this.byEl.textContent = meta.uploader || meta.artist || meta.channel || "";
    if (this.platformEl) this.platformEl.textContent = meta.extractor || "";
    if (this.durEl) this.durEl.textContent = meta.duration_formatted || meta.duration_str || "";
    if (this.statsEl && meta.view_count) {
      this.statsEl.textContent = `${Number(meta.view_count).toLocaleString("pt-BR")} visualizações`;
    }
    if (meta.thumbnail && this.thumbEl) {
      const dur = meta.duration_formatted || meta.duration_str || "";
      this.thumbEl.innerHTML = `<img src="${meta.thumbnail}" alt="Thumbnail" loading="lazy">${dur ? `<em id="card-dur">${dur}</em>` : ""}`;
    }

    const origAudio = data.originalAudio || (meta && meta.originalAudio);
    const origVideo = data.originalVideo || (meta && meta.originalVideo);
    this.updateQualityBadgeDisplay(true, origAudio);
    this.updateVideoQualityBadgeDisplay(true, origVideo);
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

  updateQualityBadgeDisplay(isOriginal, probedMeta = null) {
    if (this.groupAudioQ) {
      this.groupAudioQ.classList.toggle("chips-disabled", isOriginal);
    }
    if (this.audioOriginalBadge) {
      this.audioOriginalBadge.style.display = isOriginal ? "inline-flex" : "none";
    }
    if (this.audioManualChips) {
      this.audioManualChips.style.display = isOriginal ? "none" : "inline-flex";
    }
    if (isOriginal && this.audioOrigText) {
      const meta = probedMeta || (this.currentData && (this.currentData.originalAudio || this.currentData.metadata?.originalAudio));
      if (meta && meta.label) {
        this.audioOrigText.textContent = meta.label;
      } else if (meta && meta.codec && meta.bitrate) {
        this.audioOrigText.textContent = `Fonte original (${meta.codec} ~${Math.round(meta.bitrate)} kbps)`;
      } else if (meta && meta.ext) {
        this.audioOrigText.textContent = `Melhor qualidade da fonte (.${meta.ext})`;
      } else {
        this.audioOrigText.textContent = "Melhor disponível (Stream direto)";
      }
    }
  }

  updateVideoQualityBadgeDisplay(isOriginal, probedMeta = null) {
    if (this.groupVideoRes) {
      this.groupVideoRes.classList.toggle("chips-disabled", isOriginal);
    }
    if (this.videoOriginalBadge) {
      this.videoOriginalBadge.style.display = isOriginal ? "inline-flex" : "none";
    }
    if (this.videoManualChips) {
      this.videoManualChips.style.display = isOriginal ? "none" : "inline-flex";
    }
    if (isOriginal && this.videoOrigText) {
      const meta = probedMeta || (this.currentData && (this.currentData.originalVideo || this.currentData.metadata?.originalVideo));
      if (meta && meta.resolution) {
        const fpsStr = meta.fps && meta.fps > 30 ? ` ${meta.fps}fps` : "";
        const vbrStr = meta.vbr ? ` (~${Math.round(meta.vbr)} kbps)` : "";
        this.videoOrigText.textContent = `Fonte original (${meta.resolution}${fpsStr}${vbrStr})`;
      } else {
        this.videoOrigText.textContent = "Melhor resolução nativa (Stream direto)";
      }
    }
  }

  setOriginalMode(mode, isOriginal) {
    if (mode === "audio") {
      this.updateQualityBadgeDisplay(isOriginal);
    } else {
      this.updateVideoQualityBadgeDisplay(isOriginal);
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
