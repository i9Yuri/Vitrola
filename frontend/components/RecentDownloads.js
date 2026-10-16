/**
 * VITROLA - RECENT DOWNLOADS COMPONENT (RecentDownloads.js)
 * Gerencia a lista de downloads recentes com delegação de eventos resiliente no contêiner permanente.
 */

export class RecentDownloads {
  constructor(options = {}) {
    this.container = null;
    this.onInfo = options.onInfo || (() => {});
    this.onRetry = options.onRetry || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this._handleClick = this.handleClick.bind(this);
  }

  mount(container = document.getElementById("recent-downloads-list")) {
    if (!container) return;
    this.detach();
    this.container = container;
    this.container.addEventListener("click", this._handleClick);
  }

  detach() {
    if (this.container) {
      this.container.removeEventListener("click", this._handleClick);
    }
  }

  handleClick(event) {
    if (!event || !event.target) return;

    // 1. Botão de Informações de Erro ([i])
    const infoBtn = event.target.closest(".btn-error-info");
    if (infoBtn) {
      event.preventDefault();
      event.stopPropagation();
      const taskId = infoBtn.dataset.taskId || infoBtn.getAttribute("data-task-id");
      if (taskId && typeof this.onInfo === "function") {
        this.onInfo(taskId, infoBtn);
      }
      return;
    }

    // 2. Botão de Retentativa
    const retryBtn = event.target.closest(".btn-retry-task");
    if (retryBtn) {
      event.preventDefault();
      event.stopPropagation();
      const taskId = retryBtn.dataset.taskId || retryBtn.getAttribute("data-task-id");
      if (taskId && typeof this.onRetry === "function") {
        this.onRetry(taskId, retryBtn);
      }
      return;
    }

    // 3. Botão de Cancelamento / Exclusão de Linha
    const cancelBtn = event.target.closest(".btn-cancel-task");
    if (cancelBtn) {
      event.preventDefault();
      event.stopPropagation();
      const taskId = cancelBtn.dataset.taskId || cancelBtn.getAttribute("data-task-id");
      if (taskId && typeof this.onCancel === "function") {
        this.onCancel(taskId, cancelBtn);
      }
      return;
    }
  }
}

export const RecentDownloadsController = {
  init(options = {}) {
    const instance = new RecentDownloads(options);
    instance.mount(options.container || document.getElementById("recent-downloads-list"));
    return instance;
  }
};
