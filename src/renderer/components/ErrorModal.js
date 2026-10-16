/**
 * VITROLA - COMPONENTE ERROR MODAL (ErrorModal.js)
 * Modal descritivo amigável com visualizador de log técnico expansível e ação de reexecução imediata.
 * Implementa o contrato openErrorModal(details) e closeErrorModal().
 */

export class ErrorModal {
  constructor(options = {}) {
    this.modal = null;
    this.titleEl = null;
    this.summaryEl = null;
    this.suggestionEl = null;
    this.rawLogEl = null;
    this.btnCopy = null;
    this.btnRetry = null;
    this.closeButtons = [];
    this.currentTaskId = null;
    this.onRetry = options.onRetry || (() => {});
    this.onToast = options.onToast || (() => {});
    this._handleKeydown = this.handleKeydown.bind(this);
  }

  mount(modalElement = document.getElementById("modal-error-details")) {
    if (!modalElement) return;
    this.modal = modalElement;

    this.titleEl = modalElement.querySelector("#error-modal-title");
    this.summaryEl = modalElement.querySelector("#error-modal-summary");
    this.suggestionEl = modalElement.querySelector("#error-modal-suggestion");
    this.rawLogEl = modalElement.querySelector("#error-modal-raw-log");
    this.btnCopy = modalElement.querySelector("#btn-copy-error-log");
    this.btnRetry = modalElement.querySelector("#btn-error-retry");
    this.closeButtons = Array.from(modalElement.querySelectorAll(".btn-close-modal, #modal-close-btn, #btn-modal-close-footer"));

    this.bindEvents();
  }

  bindEvents() {
    this.closeButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.closeErrorModal());
    });

    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.closeErrorModal();
      });
    }

    if (this.btnCopy) {
      this.btnCopy.addEventListener("click", () => this.copyRawLog());
    }

    if (this.btnRetry) {
      this.btnRetry.addEventListener("click", () => {
        const tid = this.currentTaskId;
        this.closeErrorModal();
        if (tid && typeof this.onRetry === "function") {
          this.onRetry(tid);
        }
      });
    }

    window.removeEventListener("keydown", this._handleKeydown);
    window.addEventListener("keydown", this._handleKeydown);
  }

  handleKeydown(e) {
    if (e.key === "Escape" && this.isOpen()) {
      this.closeErrorModal();
    }
  }

  /**
   * Abre o modal com os detalhes da falha.
   * Contrato canônico: openErrorModal(details)
   * @param {Object} details - { taskId, mediaTitle, httpStatus?, message, rawLog, timestamp, suggestedAction }
   * @param {Function} [onRetry]
   */
  openErrorModal(details = {}, onRetry = null) {
    if (!this.modal) {
      this.mount();
      if (!this.modal) return;
    }

    this.currentTaskId = details.taskId || null;
    if (onRetry) {
      this.onRetry = onRetry;
    }

    const messageText = details.message || details.summary || "Ocorreu uma falha no processamento deste download.";
    const suggestionText = details.suggestedAction || (
      details.httpStatus === 416
        ? "Arquivos temporários parciais corrompidos foram limpos. Clique em 'Tentar Novamente' para reiniciar a extração atômica."
        : "Tente novamente ou verifique se o link ainda está acessível."
    );
    const rawText = details.rawLog || details.rawErrorLog || details.raw_log || "Nenhum detalhe técnico adicional arquivado.";

    if (this.summaryEl) {
      this.summaryEl.textContent = messageText;
    }

    if (this.suggestionEl) {
      this.suggestionEl.textContent = suggestionText;
    }

    if (this.rawLogEl) {
      this.rawLogEl.value = rawText;
    }

    const drawer = this.modal.querySelector(".error-log-drawer");
    if (drawer) {
      drawer.open = false; // Gaveta fechada por padrão
    }

    this.modal.setAttribute("aria-hidden", "false");
    this.modal.classList.add("is-active", "active", "open");
    this.modal.style.display = "grid";
  }

  open(details = {}, onRetry = null) {
    this.openErrorModal(details, onRetry);
  }

  /**
   * Fecha o modal de detalhes de falha.
   * Contrato canônico: closeErrorModal()
   */
  closeErrorModal() {
    if (this.modal) {
      this.modal.setAttribute("aria-hidden", "true");
      this.modal.classList.remove("is-active", "active", "open");
      this.modal.style.display = "none";
    }
  }

  close() {
    this.closeErrorModal();
  }

  isOpen() {
    return this.modal && (
      this.modal.classList.contains("is-active") ||
      this.modal.classList.contains("active") ||
      this.modal.classList.contains("open")
    );
  }

  async copyRawLog() {
    if (!this.rawLogEl) return;
    const text = this.rawLogEl.value;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        this.rawLogEl.select();
        document.execCommand("copy");
      }
      this.onToast("Informações técnicas copiadas para a área de transferência!", "success");
    } catch (err) {
      this.onToast("Não foi possível copiar os dados técnicos.", "warning");
    }
  }
}

export const ErrorModalController = {
  init(options = {}) {
    const instance = new ErrorModal(options);
    instance.mount();
    return instance;
  }
};
