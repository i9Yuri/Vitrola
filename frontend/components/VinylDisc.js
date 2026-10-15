/**
 * VITROLA - COMPONENTE VINYL DISC (VinylDisc.js)
 * Controlador interativo para o disco de vinil superior: rotação contínua automática (idle-spinning)
 * e controle angular por clique e arraste (user-dragging) via trigonometria polar (Math.atan2).
 */

export class VinylDisc {
  constructor(options = {}) {
    this.container = null;
    this.vinyl = null;
    this.isDragging = false;
    this.currentAngle = 0;
    this.lastPointerAngle = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.activePointerId = null;
    this.state = "SPINNING_AUTO"; // SPINNING_AUTO | DRAGGING_MANUAL

    this._onPointerDown = (e) => this.startDrag(e);
    this._onPointerMove = (e) => this.processDrag(e);
    this._onPointerUp = (e) => this.endDrag(e);
    this._onPointerCancel = (e) => this.endDrag(e);
  }

  mount(container = document.querySelector(".disc")) {
    if (!container) return;
    this.container = container;
    this.vinyl = container.querySelector(".vinyl") || container;

    this.bindEvents();
  }

  attach(container) {
    this.mount(container);
  }

  detach() {
    if (!this.vinyl) return;
    this.vinyl.removeEventListener("pointerdown", this._onPointerDown);
    this.vinyl.removeEventListener("pointermove", this._onPointerMove);
    this.vinyl.removeEventListener("pointerup", this._onPointerUp);
    this.vinyl.removeEventListener("pointercancel", this._onPointerCancel);
  }

  bindEvents() {
    if (!this.vinyl) return;

    this.vinyl.addEventListener("pointerdown", this._onPointerDown);
    this.vinyl.addEventListener("pointermove", this._onPointerMove);
    this.vinyl.addEventListener("pointerup", this._onPointerUp);
    this.vinyl.addEventListener("pointercancel", this._onPointerCancel);
  }

  startDrag(e) {
    // Apenas botão principal (esquerdo) ou toque
    if (e.button !== undefined && e.button !== 0) return;

    const rect = this.vinyl.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;

    this.currentAngle = this.getComputedRotation(this.vinyl);
    this.lastPointerAngle = this.calculateAngle(e.clientX, e.clientY);

    this.isDragging = true;
    this.state = "DRAGGING_MANUAL";
    this.activePointerId = e.pointerId;

    this.vinyl.classList.add("dragging");
    this.vinyl.style.transform = `rotate(${this.currentAngle}deg)`;

    try {
      this.vinyl.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  processDrag(e) {
    if (!this.isDragging) return;

    const currentPointerAngle = this.calculateAngle(e.clientX, e.clientY);
    let delta = currentPointerAngle - this.lastPointerAngle;

    // Normalização de transição entre quadrantes (-180° a +180°)
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    this.currentAngle = (this.currentAngle + delta) % 360;
    this.vinyl.style.transform = `rotate(${this.currentAngle}deg)`;

    this.lastPointerAngle = currentPointerAngle;
  }

  endDrag(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.state = "SPINNING_AUTO";

    if (this.activePointerId !== null) {
      try {
        this.vinyl.releasePointerCapture(this.activePointerId);
      } catch (_) {}
      this.activePointerId = null;
    }

    // Retoma suavemente o estado de rotação automática sem saltos de ângulo
    this.vinyl.style.setProperty("--current-angle", `${this.currentAngle}deg`);
    this.vinyl.style.setProperty("--start-deg", `${this.currentAngle}deg`);
    this.vinyl.style.transform = "";
    this.vinyl.classList.remove("dragging");
  }

  calculateAngle(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  getComputedRotation(el) {
    try {
      const st = window.getComputedStyle(el);
      const tr = st.transform || st.webkitTransform;
      if (!tr || tr === "none") return 0;
      const values = tr.split("(")[1].split(")")[0].split(",");
      const a = parseFloat(values[0]);
      const b = parseFloat(values[1]);
      return Math.round(Math.atan2(b, a) * (180 / Math.PI));
    } catch (_) {
      return 0;
    }
  }
}

export const VinylTracker = VinylDisc;

