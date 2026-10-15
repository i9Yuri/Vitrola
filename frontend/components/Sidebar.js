/**
 * MARÉ - COMPONENTE SIDEBAR (Sidebar.js)
 * Navegação simplificada (Baixar, Histórico, Ajustes) e acoplamento do modal de destino.
 */

export class Sidebar {
  constructor(options = {}) {
    this.onViewChange = options.onViewChange || (() => {});
    this.onOpenDestinationModal = options.onOpenDestinationModal || (() => {});
  }

  mount(container = document.querySelector(".sidebar")) {
    if (!container) return;
    this.container = container;
    this.destPath = container.querySelector("#dest-path");
    this.engineStatus = container.querySelector("#engine-status-text");

    const navButtons = container.querySelectorAll(".nav button");
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        this.setActiveView(view);
        this.onViewChange(view);
      });
    });

    const destBtn = container.querySelector("#btn-dest");
    if (destBtn) {
      destBtn.addEventListener("click", () => this.onOpenDestinationModal());
    }
  }

  setActiveView(view) {
    if (!this.container) return;
    const navButtons = this.container.querySelectorAll(".nav button");
    navButtons.forEach((b) => {
      if (b.dataset.view === view) {
        b.setAttribute("aria-current", "page");
      } else {
        b.removeAttribute("aria-current");
      }
    });
  }

  setDestination(path) {
    if (this.destPath) {
      this.destPath.textContent = path.replace(/\/home\/[^/]+/, "~");
      this.destPath.title = path;
    }
  }
}
