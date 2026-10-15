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

    if (btnMin) {
      btnMin.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onWindowAction("minimize");
      });
    }
    if (btnMax) {
      btnMax.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onWindowAction("maximize");
      });
    }
    if (btnClose) {
      btnClose.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onWindowAction("close");
      });
    }

    // Duplo clique na barra de título alterna maximização
    container.addEventListener("dblclick", (e) => {
      if (!e.target.closest("button") && !e.target.closest("a") && !e.target.closest("input")) {
        this.onWindowAction("maximize");
      }
    });

    // Mousedown em área livre aciona arraste nativo se aplicável
    container.addEventListener("mousedown", (e) => {
      if (e.button === 0 && !e.target.closest("button") && !e.target.closest("a") && !e.target.closest("input")) {
        this.onWindowAction("start_drag");
      }
    });
  }
}
