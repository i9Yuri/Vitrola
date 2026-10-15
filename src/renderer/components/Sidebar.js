/**
 * FITA / MEDIAFORGE - COMPONENTE SIDEBAR (Sidebar.js)
 * Navegação por abas, badge dinâmico da fila e monitor de integridade.
 */

export class Sidebar {
  constructor(options = {}) {
    this.onViewChange = options.onViewChange || (() => {});
    this.onOpenDestination = options.onOpenDestination || (() => {});
  }

  mount(container = document.querySelector(".sidebar")) {
    if (!container) return;
    this.container = container;
    this.countBadge = container.querySelector("#nav-queue-count");
    this.destPath = container.querySelector("#dest-path");
    this.engineStatus = container.querySelector("#engine-status-text");

    const navButtons = container.querySelectorAll(".nav button");
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        this.onViewChange(view);
      });
    });

    const destBtn = container.querySelector("#btn-dest");
    if (destBtn) {
      destBtn.addEventListener("click", () => this.onOpenDestination());
    }
  }

  setQueueCount(count) {
    if (!this.countBadge) return;
    this.countBadge.textContent = count;
    if (count > 0) {
      this.countBadge.classList.remove("hidden");
    } else {
      this.countBadge.classList.add("hidden");
    }
  }

  setDestination(path) {
    if (this.destPath) {
      this.destPath.textContent = path.replace(/\/home\/[^/]+/, "~");
      this.destPath.title = path;
    }
  }
}
