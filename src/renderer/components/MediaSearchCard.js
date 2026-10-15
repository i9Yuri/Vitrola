/**
 * MARÉ - COMPONENTE MEDIA SEARCH CARD (MediaSearchCard.js)
 * Input de busca, preview 16:9, alternador de modo (Áudio/Vídeo), chips de formato/qualidade e switches.
 */

export class MediaSearchCard {
  constructor(options = {}) {
    this.onModeChange = options.onModeChange || (() => {});
    this.onStartDownload = options.onStartDownload || (() => {});
  }

  mount(cardElement = document.getElementById("result-card")) {
    if (!cardElement) return;
    this.card = cardElement;
  }

  show() {
    if (this.card) this.card.classList.remove("hidden");
  }

  hide() {
    if (this.card) this.card.classList.add("hidden");
  }
}
