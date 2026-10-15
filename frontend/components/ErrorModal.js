/**
 * VITROLA - COMPONENTE ERROR MODAL (ErrorModal.js)
 * Modal descritivo amigável com visualizador de log técnico expansível e ação de reexecução imediata.
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
    this.btnClose = null;
    this.currentTaskId = null;
    this.onRetry = options.onRetry || (() => {});
    this.onToast = options.onToast || (() => {});
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
    this.btnClose = modalElement.querySelector(".btn-close-modal");

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    if (this.btnCopy) {
      this.btnCopy.addEventListener("click", () => this.copyRawLog());
    }

    if (this.btnRetry) {
      this.btnRetry.addEventListener("click", () => {
        const tid = this.currentTaskId;
        this.close();
        if (tid && typeof this.onRetry === "function") {
          this.onRetry(tid);
        }
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) {
        this.close();
      }
    });
  }

  open(errorDetails = {}, onRetry = null) {
    if (!this.modal) {
      this.mount();
      if (!this.modal) return;
    }

    this.currentTaskId = errorDetails.taskId || null;
    if (onRetry) {
      this.onRetry = onRetry;
    }

    if (this.summaryEl) {
      this.summaryEl.textContent = errorDetails.summary || "Ocorreu uma falha no processamento deste download.";
    }

    if (this.suggestionEl) {
      this.suggestionEl.textContent = errorDetails.suggestedAction || "Tente novamente.";
    }

    if (this.rawLogEl) {
      this.rawLogEl.value = errorDetails.rawErrorLog || errorDetails.raw_log || "Nenhum log adicional retornado.";
    }

    const drawer = this.modal.querySelector(".error-log-drawer");
    if (drawer) {
      drawer.open = false; // Fecha a gaveta por padrão
    }

    this.modal.classList.add("open");
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove("open");
    }
  }

  isOpen() {
    return this.modal && this.modal.classList.contains("open");
  }

  async copyRawLog() {
    if (!this.rawLogEl) return;
    const text = this.rawLogEl.value;
    try {
      if (window.electronAPI && typeof window.electronAPI.readClipboard === "function") {
        // Fallback or copy via navigator
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        this.rawLogEl.select();
        document.execCommand("copy");
      }
      this.onToast("Log copiado para a área de transferência!", "success");
    } catch (err) {
      this.onToast("Não foi possível copiar o log.", "warning");
    }
  }
}
