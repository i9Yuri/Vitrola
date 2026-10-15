/**
 * VITROLA - COMPONENTE TITLEBAR (TitleBar.js)
 * Controles de janela desacoplados, branding e ações de menu.
 */

export class TitleBar {
  constructor(options = {}) {
    this.onWindowAction = options.onWindowAction || (() => {});
  }

  mount(container = document.querySelector(".titlebar")) {
    if (!container) return;
    this.container = container;

    const btnMin = container.querySelector("#btn-win-min");
    const btnMax = container.querySelector("#btn-win-max");
    const btnClose = container.querySelector("#btn-win-close");

    if (btnMin) btnMin.addEventListener("click", () => this.onWindowAction("minimize"));
    if (btnMax) btnMax.addEventListener("click", () => this.onWindowAction("maximize"));
    if (btnClose) btnClose.addEventListener("click", () => this.onWindowAction("close"));
  }
}
