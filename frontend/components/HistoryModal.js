/**
 * FITA / MEDIAFORGE - COMPONENTE DE HISTÓRICO (HistoryModal.js)
 * Deduplicação de registros, contador cumulativo, sanitização de datas e validação no disco.
 */

import { checkAndShowItem } from "../../main/ipc/filesystem-handler.js";

function formatTimestamp(timestampStr) {
  if (!timestampStr) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  }
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
    }
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
  } catch (_) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  }
}

export class HistoryModal {
  constructor(options = {}) {
    this.modal = options.modalElement || document.getElementById("modal-library");
    this.listContainer = options.listElement || document.getElementById("library-list");
    this.onToast = options.onToast || (() => {});
  }

  open() {
    if (this.modal) this.modal.classList.add("active");
  }

  close() {
    if (this.modal) this.modal.classList.remove("active");
  }

  render(items = []) {
    if (!this.listContainer) return;

    if (!items || items.length === 0) {
      this.listContainer.innerHTML = `<p class="q-empty">Nenhum download registrado no histórico.</p>`;
      return;
    }

    this.listContainer.innerHTML = items
      .map((item) => {
        const count = item.download_count || item.downloadCount || 1;
        const countBadge =
          count > 1
            ? `<span style="background:var(--soft);color:var(--accent);font-size:11px;font-weight:700;padding:2px 6px;border-radius:6px;border:1px solid var(--accent);margin-left:6px">${count}x</span>`
            : "";
        const formattedDate = formatTimestamp(item.completed_at || item.completedAt || item.timestamp);
        const sizeStr = item.total_size || item.size || "Concluído";
        const formatLabel = item.format ? ` • ${item.format.toUpperCase()}` : "";

        return `
          <div class="dl done" style="background:var(--surface);margin-bottom:8px;border:1px solid var(--line);border-radius:12px;padding:10px 14px">
            <div class="dl-body">
              <div class="dl-top" style="align-items:center">
                <span class="dl-title" title="${item.title || "Mídia"}">${item.title || "Download sem título"}</span>
                <span class="ok" style="font-size:12px"><svg class="i" style="width:14px;height:14px"><use href="#i-check"/></svg>${sizeStr}</span>
              </div>
              <div class="dl-sub" style="display:flex;align-items:center;margin-top:4px">
                <span>${item.filename || item.mode || "Mídia"}${formatLabel} • ${formattedDate}</span>
                ${countBadge}
              </div>
            </div>
            <button class="x btn-check-open-file" data-filepath="${item.filepath || item.filePath || ""}" title="Abrir arquivo no disco">
              <svg class="i"><use href="#i-folder"/></svg>
            </button>
          </div>
        `;
      })
      .join("");

    // Vincula verificação de integridade a cada botão de pasta
    this.listContainer.querySelectorAll(".btn-check-open-file").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const path = btn.dataset.filepath;
        if (!path) {
          this.onToast("Caminho do arquivo não registrado.", "warning");
          return;
        }

        const res = await checkAndShowItem(path);
        if (!res.exists) {
          this.onToast(
            res.error || "O arquivo não foi encontrado no disco. Ele pode ter sido movido ou excluído.",
            "error"
          );
        } else {
          this.onToast("Arquivo localizado e revelado no gerenciador.", "success");
        }
      });
    });
  }
}
