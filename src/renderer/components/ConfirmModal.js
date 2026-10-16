/**
 * VITROLA - MODAL CUSTOMIZADO DE CONFIRMAÇÃO (ConfirmModal.js)
 * Substitui diálogos bloqueantes nativos do sistema operacional (window.confirm)
 * por um modal assíncrono dark-theme baseado em Promise<boolean>.
 */

export class ConfirmModal {
  constructor(options = {}) {
    this.modalEl = options.modalElement || document.getElementById("modal-confirm");
    this.titleEl = options.titleElement || document.getElementById("confirm-title");
    this.messageEl = options.messageElement || document.getElementById("confirm-message");
    this.btnCancel = options.btnCancel || document.getElementById("btn-confirm-cancel");
    this.btnConfirm = options.btnConfirm || document.getElementById("btn-confirm-accept");
    this.btnClose = options.btnClose || document.getElementById("btn-confirm-close");
    this._resolve = null;
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._initEvents();
  }

  _initEvents() {
    if (this.btnCancel) {
      this.btnCancel.addEventListener("click", () => this.reject());
    }
    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.reject());
    }
    if (this.btnConfirm) {
      this.btnConfirm.addEventListener("click", () => this.accept());
    }
    if (this.modalEl) {
      this.modalEl.addEventListener("click", (e) => {
        if (e.target === this.modalEl) {
          this.reject();
        }
      });
    }
  }

  _handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.reject();
    }
  }

  accept() {
    this.close(true);
  }

  reject() {
    this.close(false);
  }

  close(result) {
    if (!this.modalEl) return;
    this.modalEl.classList.remove("active");
    this.modalEl.classList.remove("is-active");
    this.modalEl.classList.remove("open");
    this.modalEl.setAttribute("aria-hidden", "true");
    window.removeEventListener("keydown", this._onKeyDown);
    if (typeof this._resolve === "function") {
      const res = this._resolve;
      this._resolve = null;
      res(result);
    }
  }

  show(options = {}) {
    const {
      title = "Confirmar Ação",
      message = "Tem certeza que deseja prosseguir?",
      confirmLabel = "Confirmar",
      cancelLabel = "Cancelar",
      isDestructive = true,
    } = options;

    return new Promise((resolve) => {
      this._resolve = resolve;

      if (this.titleEl) {
        // Preserva ícone se houver
        const iconSvg = this.titleEl.querySelector("svg");
        this.titleEl.textContent = title;
        if (iconSvg) {
          this.titleEl.prepend(iconSvg);
        }
      }
      if (this.messageEl) this.messageEl.textContent = message;
      if (this.btnConfirm) {
        this.btnConfirm.textContent = confirmLabel;
        if (isDestructive) {
          this.btnConfirm.classList.add("btn-destructive");
        } else {
          this.btnConfirm.classList.remove("btn-destructive");
        }
      }
      if (this.btnCancel) {
        this.btnCancel.textContent = cancelLabel;
      }

      if (this.modalEl) {
        this.modalEl.classList.add("active");
        this.modalEl.removeAttribute("aria-hidden");
      }

      window.addEventListener("keydown", this._onKeyDown);

      // Posiciona o foco inicial no botão Cancelar para prevenir disparo acidental com Enter
      if (this.btnCancel) {
        setTimeout(() => {
          try {
            this.btnCancel.focus();
          } catch (_) {}
        }, 50);
      }
    });
  }
}

let defaultConfirmModalInstance = null;

export function showCustomConfirmDialog(options = {}) {
  if (!defaultConfirmModalInstance) {
    defaultConfirmModalInstance = new ConfirmModal();
  }
  return defaultConfirmModalInstance.show(options);
}
