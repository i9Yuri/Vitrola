/**
 * VITROLA - COMPONENTE DE HISTÓRICO (HistoryModal.js)
 * Deduplicação de registros, agregação de contagem, sanitização de strings ambíguas ("NA"),
 * exclusão granular e expurgo total de registros.
 */

import { checkAndShowItem } from "../../main/ipc/filesystem-handler.js";
import {
  aggregateHistory,
  sanitizeMetadataString,
  deleteHistoryItem,
  clearAllHistory,
} from "../../main/ipc/history-handler.js";

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
    this.totalCountEl = options.totalCountElement || document.getElementById("history-total-count");
    this.btnClearHistory = options.btnClearElement || document.getElementById("btn-clear-history");
    this.onToast = options.onToast || (() => {});
    this.onReload = options.onReload || (() => {});

    this._bindFooterEvents();
  }

  _bindFooterEvents() {
    if (this.btnClearHistory) {
      this.btnClearHistory.addEventListener("click", async () => {
        const confirmed = window.confirm(
          "Tem certeza que deseja apagar todo o histórico de downloads? Os arquivos no disco permanecerão intactos."
        );
        if (!confirmed) return;

        try {
          const res = await clearAllHistory();
          if (res.success) {
            this.onToast("Histórico de downloads completamente limpo.", "success");
            this.onReload();
          } else {
            this.onToast(res.error || "Falha ao limpar o histórico.", "error");
          }
        } catch (err) {
          this.onToast(`Erro ao limpar histórico: ${err.message}`, "error");
        }
      });
    }
  }

  open() {
    if (this.modal) this.modal.classList.add("active");
  }

  close() {
    if (this.modal) this.modal.classList.remove("active");
  }

  render(rawItems = []) {
    if (!this.listContainer) return;

    const items = aggregateHistory(rawItems);

    if (this.totalCountEl) {
      const count = items.length;
      this.totalCountEl.textContent = `${count} ${count === 1 ? "item" : "itens"}`;
    }

    if (this.btnClearHistory) {
      this.btnClearHistory.disabled = items.length === 0;
      this.btnClearHistory.style.opacity = items.length === 0 ? "0.4" : "1";
    }

    if (!items || items.length === 0) {
      this.listContainer.innerHTML = `<p class="q-empty">Nenhum download registrado no histórico.</p>`;
      return;
    }

    this.listContainer.innerHTML = items
      .map((item) => {
        const count = item.downloadCount || 1;
        const countBadge =
          count > 1
            ? `<span class="count-badge">${count}x</span>`
            : "";
        const formattedDate = formatTimestamp(item.completedAt || item.completed_at);
        const sizeStr = sanitizeMetadataString(item.total_size || item.size, "Concluído");
        const rawFormat = sanitizeMetadataString(item.format, item.mode || "áudio");
        const formatLabel = rawFormat ? ` • ${rawFormat.toUpperCase()}` : "";
        const displayTitle = sanitizeMetadataString(item.title, "Mídia sem título");
        const displayFilename = sanitizeMetadataString(item.filename, displayTitle);

        return `
          <div class="dl done" style="background:var(--surface);margin-bottom:8px;border:1px solid var(--line);border-radius:12px;padding:10px 14px">
            <div class="dl-body">
              <div class="dl-top" style="align-items:center">
                <span class="dl-title" title="${displayTitle}">${displayTitle}</span>
                <span class="ok" style="font-size:12px"><svg class="i" style="width:14px;height:14px"><use href="#i-check"/></svg>${sizeStr}</span>
              </div>
              <div class="dl-sub" style="display:flex;align-items:center;margin-top:4px">
                <span>${displayFilename}${formatLabel} • ${formattedDate}</span>
                ${countBadge}
              </div>
            </div>
            <div class="history-card-actions">
              <button class="x btn-check-open-file" data-filepath="${item.filePath || item.filepath || ""}" title="Abrir arquivo no disco">
                <svg class="i"><use href="#i-folder"/></svg>
              </button>
              <button class="x btn-delete-history-item" data-mediakey="${item.mediaKey}" data-title="${displayTitle}" title="Remover do histórico">
                <svg class="i"><use href="#i-trash"/></svg>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Verificação e abertura no gerenciador de arquivos
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

    // Exclusão individual de item do histórico
    this.listContainer.querySelectorAll(".btn-delete-history-item").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.mediakey;
        const title = btn.dataset.title;
        if (!key) return;

        try {
          const res = await deleteHistoryItem(key);
          if (res.success) {
            this.onToast(`"${title}" removido do histórico.`, "success");
            this.onReload();
          } else {
            this.onToast(res.error || "Falha ao remover item do histórico.", "error");
          }
        } catch (err) {
          this.onToast(`Erro ao remover: ${err.message}`, "error");
        }
      });
    });
  }
}
