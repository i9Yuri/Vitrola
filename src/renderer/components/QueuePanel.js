/**
 * FITA / MEDIAFORGE - COMPONENTE QUEUE PANEL (QueuePanel.js)
 * Painel de fila de downloads com barras determinísticas de forma de onda.
 */

function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export class QueuePanel {
  static renderWaveform(waveElement, seed, progressPercent) {
    if (!waveElement) return;
    const n = 44;
    const p = Math.max(0, Math.min(100, progressPercent)) / 100;
    const cut = Math.round(n * p);
    const r = rng(seed);

    if (waveElement.children.length !== n) {
      waveElement.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const env = 0.55 + 0.45 * Math.sin((i / n) * Math.PI * 3.2 + seed);
        const h = Math.max(0.18, Math.min(1.0, env * (0.55 + 0.45 * r())));
        const bar = document.createElement("i");
        bar.style.height = Math.round(h * 100) + "%";
        waveElement.appendChild(bar);
      }
    }

    const bars = waveElement.children;
    for (let i = 0; i < n; i++) {
      if (i < cut) {
        bars[i].className = i === cut - 1 && p < 1 ? "on edge" : "on";
      } else {
        bars[i].className = "";
      }
    }

    waveElement.setAttribute("role", "progressbar");
    waveElement.setAttribute("aria-valuenow", String(Math.round(progressPercent)));
    waveElement.setAttribute("aria-valuemin", "0");
    waveElement.setAttribute("aria-valuemax", "100");
  }
}
