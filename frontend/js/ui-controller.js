/**
 * VITROLA - CONTROLADOR DE INTERFACE (ui-controller.js)
 * Orquestração de eventos, busca com yt-dlp, telemetria de disco, fila reativa e layout Sonora.
 */

import { themeManager } from "./theme-manager.js";
import { ytdlpManager } from "./ytdlp-manager.js";
import { minimizeWindow, maximizeWindow, closeWindow, startWindowDrag } from "../../main/ipc/window-controls.js";
import { HistoryModal } from "../components/HistoryModal.js";
import { TitleBar } from "../components/TitleBar.js";
import { StatusBar } from "../components/StatusBar.js";
import { Sidebar } from "../components/Sidebar.js";
import { MediaSearchCard } from "../components/MediaSearchCard.js";
import { SettingsModal } from "../components/SettingsModal.js";

class UIController {
  constructor() {
    this.currentInspection = null;
    this.currentUrl = "";
    this.activeMode = "audio"; // "audio" | "video"
    this.audioFormat = "MP3";
    this.audioBitrate = 320;
    this.videoFormat = "MP4";
    this.videoRes = "1080p";
    this.embedMetadata = true;
    this.embedSubtitles = false;
    this.activeTasks = new Map(); // taskId -> { data, eventSource, rowEl, ... }
    this.completedTasks = [];
    this.config = null;
    this.currentDestinationDir = "";
  }

  init() {
    this.cacheDom();
    this.initComponents();
    this.bindEvents();
    this.initThemes();
    this.initYtDlp();
    this.initMinimizedStateListener();
    this.loadConfig();
    this.loadHistory();
    this.setupGlobalPaste();
  }

  initMinimizedStateListener() {
    if (window.electronAPI && typeof window.electronAPI.onMinimizedState === "function") {
      window.electronAPI.onMinimizedState((isMinimized) => {
        if (isMinimized) {
          document.documentElement.setAttribute("data-minimized", "true");
        } else {
          document.documentElement.removeAttribute("data-minimized");
        }
      });
    }
  }

  initComponents() {
    // Titlebar
    this.titleBar = new TitleBar({
      onWindowAction: (action) => this.handleWindowAction(action),
    });
    this.titleBar.mount();

    // StatusBar
    this.statusBar = new StatusBar();
    this.statusBar.mount(document.getElementById("status-bar"));
    this.statusBar.setVersion("Vitrola v2.3.0");

    // Sidebar
    this.sidebar = new Sidebar({
      onViewChange: (view) => this.handleViewChange(view),
    });
    this.sidebar.mount();

    // Media Search Card
    this.mediaSearchCard = new MediaSearchCard();
    this.mediaSearchCard.mount(document.getElementById("result-card"));

    // Settings Modal
    this.settingsModal = new SettingsModal({
      modalElement: this.modalSettings,
      onDestinationChanged: (newPath) => this.updateDestination(newPath),
      onToast: (msg, type) => this.showToast(msg, type),
    });
  }

  cacheDom() {
    // Window root
    this.winRoot = document.querySelector(".window");

    // Search bar
    this.searchForm = document.getElementById("search-form");
    this.inputUrl = document.getElementById("input-url");
    this.btnPaste = document.getElementById("btn-paste");
    this.btnSearch = document.getElementById("btn-search");

    // Result Card
    this.card = document.getElementById("result-card");
    this.cardThumb = document.getElementById("card-thumb");
    this.cardDur = document.getElementById("card-dur");
    this.cardTitle = document.getElementById("card-title");
    this.cardBy = document.getElementById("card-by");
    this.cardPlatform = document.getElementById("card-platform");
    this.cardStats = document.getElementById("card-stats");
    this.segBtns = document.querySelectorAll(".seg button");
    this.chipsAudioFmt = document.querySelectorAll(".chips-audio-fmt span");
    this.chipsAudioQ = document.querySelectorAll(".chips-audio-q span");
    this.chipsVideoFmt = document.querySelectorAll(".chips-video-fmt span");
    this.chipsVideoRes = document.querySelectorAll(".chips-video-res span");
    this.lblSizeA = document.getElementById("lbl-size");
    this.lblSizeV = document.getElementById("lbl-size-v");
    this.btnGo = document.getElementById("btn-go");
    this.destPath = document.getElementById("dest-path");

    // Recent downloads list
    this.recentList = document.getElementById("recent-downloads-list");
    this.btnViewAllHistory = document.getElementById("btn-view-all-history");

    // Modals & Toast
    this.modalSettings = document.getElementById("modal-settings");
    this.modalLibrary = document.getElementById("modal-library");
    this.libraryList = document.getElementById("library-list");
    this.toast = document.getElementById("toast");
    this.toastMsg = document.getElementById("toast-msg");

    // Settings Modal triggers
    this.btnCheckYtdlp = document.getElementById("btn-check-ytdlp");
    this.btnUpdateYtdlp = document.getElementById("btn-update-ytdlp");
    this.ytdlpVersionBadge = document.getElementById("ytdlp-version-badge");
    this.ytdlpLogs = document.getElementById("ytdlp-logs");
  }

  bindEvents() {
    // Search & Paste
    if (this.searchForm) {
      this.searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.inspectCurrentUrl();
      });
    }

    if (this.btnPaste) {
      this.btnPaste.addEventListener("click", () => this.pasteFromClipboard());
    }

    // Segmented Mode Toggle (Áudio vs Vídeo)
    this.segBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.m;
        this.setMode(mode);
      });
    });

    // Audio format chips (MP3, Opus, M4A - RIGOROSAMENTE SEM FLAC)
    this.chipsAudioFmt.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsAudioFmt.forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        this.audioFormat = chip.dataset.fmt || chip.textContent.trim();
        this.recalcEstimatedSize();
      });
    });

    // Audio quality chips
    this.chipsAudioQ.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsAudioQ.forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        this.audioBitrate = parseInt(chip.dataset.bitrate, 10) || 320;
        this.recalcEstimatedSize();
      });
    });

    // Video format chips
    this.chipsVideoFmt.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsVideoFmt.forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        this.videoFormat = chip.dataset.fmt || chip.textContent.trim();
        this.recalcEstimatedSize();
      });
    });

    // Video res chips
    this.chipsVideoRes.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsVideoRes.forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        this.videoRes = chip.dataset.res || chip.textContent.trim();
        this.recalcEstimatedSize();
      });
    });

    // Go / Download trigger
    if (this.btnGo) {
      this.btnGo.addEventListener("click", () => this.startDownload());
    }

    // View all history link
    if (this.btnViewAllHistory) {
      this.btnViewAllHistory.addEventListener("click", () => {
        this.loadHistory();
        this.openModal(this.modalLibrary);
      });
    }

    // Modal close backdrops
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop || e.target.closest(".btn-close-modal")) {
          this.closeModals();
        }
      });
    });

    // Settings yt-dlp triggers
    if (this.btnCheckYtdlp) {
      this.btnCheckYtdlp.addEventListener("click", () => ytdlpManager.triggerCheck());
    }
    if (this.btnUpdateYtdlp) {
      this.btnUpdateYtdlp.addEventListener("click", () => ytdlpManager.triggerUpdate());
    }
  }

  handleViewChange(view) {
    if (view === "settings") {
      this.openModal(this.modalSettings);
    } else if (view === "history") {
      this.loadHistory();
      this.openModal(this.modalLibrary);
    } else {
      this.closeModals();
      this.sidebar.setActiveView("home");
    }
  }

  // --------------------------------------------------------------------------
  // Temas & UI
  // --------------------------------------------------------------------------
  initThemes() {
    themeManager.apply();
  }

  initYtDlp() {
    ytdlpManager.subscribe((state) => {
      let statusText = "yt-dlp e ffmpeg prontos";
      if (state.status === "checking") {
        statusText = "Verificando yt-dlp...";
      } else if (state.status === "updating") {
        statusText = "Atualizando yt-dlp...";
      } else if (state.status === "available") {
        statusText = `yt-dlp v${state.latestVersion} disponível`;
      } else if (state.currentVersion && state.currentVersion !== "carregando...") {
        statusText = `yt-dlp v${state.currentVersion} e ffmpeg prontos`;
      }

      this.statusBar.setEngineStatus(state.status, statusText);

      if (this.ytdlpVersionBadge) {
        this.ytdlpVersionBadge.textContent = `v${state.currentVersion || "..."}`;
      }

      if (this.btnUpdateYtdlp) {
        this.btnUpdateYtdlp.disabled = state.status === "updating";
        this.btnUpdateYtdlp.textContent = state.status === "updating" ? "Atualizando..." : "Atualizar Agora";
      }

      if (this.ytdlpLogs && state.logs.length > 0) {
        this.ytdlpLogs.textContent = state.logs.join("\n");
        this.ytdlpLogs.scrollTop = this.ytdlpLogs.scrollHeight;
      }
    });

    ytdlpManager.checkStatus();
  }

  // --------------------------------------------------------------------------
  // Config, Pastas e Telemetria de Disco
  // --------------------------------------------------------------------------
  async loadConfig() {
    try {
      // Migração padronizada de chaves legadas
      try {
        const legacyKeys = ["mediaforge_settings", "mediaforge_config", "fita_config", "mare_settings", "mare_config"];
        let legacyData = null;
        for (const k of legacyKeys) {
          const item = localStorage.getItem(k);
          if (item && !legacyData) legacyData = item;
          localStorage.removeItem(k);
        }
        if (legacyData && !localStorage.getItem("vitrola_settings")) {
          localStorage.setItem("vitrola_settings", legacyData);
        }
      } catch (_) {}

      // Busca do diretório via IPC Electron ou HTTP
      let dir = "";
      if (window.electronAPI && typeof window.electronAPI.getDownloadPath === "function") {
        dir = await window.electronAPI.getDownloadPath();
      }

      if (!dir) {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (data.success && data.config) {
          this.config = data.config;
          dir = data.config.effective_download_dir || data.config.storage?.download_dir || "~/Música/Vitrola";
        }
      }

      this.updateDestination(dir || "~/Música/Vitrola");
    } catch (err) {
      console.warn("[UI] Falha ao carregar configuração:", err);
      this.updateDestination("~/Música/Vitrola");
    }
  }

  updateDestination(dir) {
    if (!dir) return;
    this.currentDestinationDir = dir;
    const displayPath = dir.replace(/\/home\/[^/]+/, "~");

    if (this.destPath) {
      this.destPath.textContent = displayPath;
      this.destPath.title = dir;
    }

    if (this.settingsModal) {
      this.settingsModal.setDestinationPath(dir);
    }

    this.loadStorageTelemetry();
  }

  async loadStorageTelemetry() {
    try {
      let data = null;
      if (window.electronAPI && typeof window.electronAPI.getDirectoryTelemetry === "function") {
        data = await window.electronAPI.getDirectoryTelemetry(this.currentDestinationDir);
      } else {
        const res = await fetch("/api/storage/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: this.currentDestinationDir }),
        });
        const resJson = await res.json();
        if (resJson.success) data = resJson.data;
      }

      if (data && this.sidebar) {
        this.sidebar.updateTelemetry(data);
      }
    } catch (e) {
      console.warn("[UI] Falha na telemetria de disco:", e);
    }
  }

  // --------------------------------------------------------------------------
  // Atalhos Globais e Paste
  // --------------------------------------------------------------------------
  setupGlobalPaste() {
    window.addEventListener("keydown", async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const active = document.activeElement;
        const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          await this.pasteFromClipboard();
        }
      }
    });
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith("http")) {
        this.inputUrl.value = text.trim();
        this.showToast("Link colado da área de transferência", "success");
        this.inspectCurrentUrl();
      } else {
        this.showToast("Nenhum link válido encontrado na área de transferência", "warning");
      }
    } catch (err) {
      console.warn("[UI] Falha no clipboard:", err);
      this.showToast("Acesso à área de transferência restrito", "warning");
    }
  }

  // --------------------------------------------------------------------------
  // Inspeção de Mídia
  // --------------------------------------------------------------------------
  async inspectCurrentUrl() {
    const url = this.inputUrl.value.trim();
    if (!url) return;

    this.currentUrl = url;
    this.card.classList.remove("hidden");
    this.card.classList.add("loading");
    this.btnSearch.disabled = true;

    try {
      const res = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.success && data.metadata) {
        this.currentInspection = data;
        this.populateCard(data);
      } else {
        this.showToast(data.error || "URL inválida ou não suportada", "error");
        this.card.classList.add("hidden");
      }
    } catch (err) {
      this.showToast(`Erro ao conectar com o serviço: ${err.message}`, "error");
      this.card.classList.add("hidden");
    } finally {
      this.card.classList.remove("loading");
      this.btnSearch.disabled = false;
    }
  }

  populateCard(data) {
    const meta = data.metadata;
    this.cardTitle.textContent = meta.title || "Mídia sem título";
    this.cardBy.textContent = meta.uploader || "Canal / Artista";

    const durationStr = meta.duration_formatted || "--:--";
    this.cardDur.textContent = durationStr;

    const views = meta.view_count ? Number(meta.view_count).toLocaleString("pt-BR") : "0";
    if (this.cardStats) {
      this.cardStats.textContent = `${views} visualizações`;
    }
    if (this.cardPlatform) {
      this.cardPlatform.textContent = meta.extractor || "Web";
    }

    // Thumbnail no mockup de vinil (.sleeve)
    if (meta.thumbnail && this.cardThumb) {
      this.cardThumb.innerHTML = `<img src="${meta.thumbnail}" alt="Thumbnail" loading="lazy"><em id="card-dur">${durationStr}</em>`;
    }

    if (meta.is_music_track && !meta.has_real_video) {
      this.setMode("audio");
    } else {
      this.setMode(this.activeMode || "audio");
    }

    this.recalcEstimatedSize();
  }

  setMode(mode) {
    this.activeMode = mode;
    if (this.winRoot) this.winRoot.dataset.mode = mode;
    if (this.card) this.card.dataset.mode = mode;

    this.segBtns.forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.m === mode);
    });

    this.recalcEstimatedSize();
  }

  recalcEstimatedSize() {
    if (!this.currentInspection || !this.currentInspection.metadata) {
      if (this.lblSizeA) this.lblSizeA.textContent = "≈ -- MB";
      if (this.lblSizeV) this.lblSizeV.textContent = "≈ -- MB";
      return;
    }

    const dur = this.currentInspection.metadata.duration || 240;

    // Áudio
    const kbps = this.audioBitrate || 320;
    const bytesA = (kbps * 1000 * dur) / 8;
    const mbA = (bytesA / (1024 * 1024)).toFixed(1).replace(".", ",");
    if (this.lblSizeA) this.lblSizeA.textContent = `≈ ${mbA} MB`;

    // Vídeo
    let factor = 0.25;
    if (this.videoRes.includes("720")) factor = 0.15;
    else if (this.videoRes.includes("480")) factor = 0.08;
    else if (this.videoRes.includes("360")) factor = 0.05;

    const approxMbV = Math.max(2, Math.round(dur * factor));
    if (this.lblSizeV) this.lblSizeV.textContent = `≈ ${approxMbV} MB`;
  }

  // --------------------------------------------------------------------------
  // Início de Download
  // --------------------------------------------------------------------------
  async startDownload() {
    if (!this.currentInspection || !this.currentUrl) return;

    const payload = {
      url: this.currentUrl,
      mode: this.activeMode,
      title: this.currentInspection.metadata.title,
      format: this.activeMode === "audio" ? this.audioFormat : this.videoFormat,
      format_id: null,
      target_res: parseInt(this.videoRes, 10) || 1080,
      embed_metadata: this.embedMetadata,
      embed_thumbnail: true,
      embed_subtitles: this.embedSubtitles,
    };

    if (this.activeMode === "audio" && this.currentInspection.audio_streams) {
      const match = this.currentInspection.audio_streams.find((s) => s.ext === this.audioFormat.toLowerCase());
      if (match) payload.format_id = match.format_id;
    }

    try {
      this.btnGo.disabled = true;
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success && data.task_id) {
        this.showToast("Download adicionado à lista!", "success");
        this.createRecentItem(data.task_id, payload, this.currentInspection.metadata);
        this.listenTaskProgress(data.task_id);
      } else {
        this.showToast(data.error || "Erro ao iniciar download", "error");
      }
    } catch (err) {
      this.showToast(`Falha na requisição: ${err.message}`, "error");
    } finally {
      this.btnGo.disabled = false;
    }
  }

  createRecentItem(taskId, payload, metadata) {
    const emptyRow = this.recentList.querySelector(".empty-row");
    if (emptyRow) emptyRow.remove();

    const row = document.createElement("div");
    row.className = "row";
    row.id = `row-task-${taskId}`;

    const tagText = payload.mode === "audio" ? `${payload.format} ${this.audioBitrate} kbps` : `${payload.format} ${payload.target_res}p`;
    const thumbHtml = metadata.thumbnail
      ? `<img src="${metadata.thumbnail}" alt="Capa" loading="lazy">`
      : "";

    row.innerHTML = `
      <span class="cv">${thumbHtml}</span>
      <div>
        <strong title="${metadata.title}">${metadata.title}</strong>
        <small>${metadata.uploader || "Mídia"}</small>
      </div>
      <span class="tag">${tagText}</span>
      <div class="st" id="st-${taskId}">
        <span class="bar"><i id="bar-${taskId}" style="width: 0%"></i></span>
        <span id="txt-${taskId}">0%</span>
      </div>
      <button class="ib btn-cancel-task" data-task-id="${taskId}" aria-label="Cancelar download">
        <svg class="i"><use href="#x"/></svg>
      </button>
    `;

    const cancelBtn = row.querySelector(".btn-cancel-task");
    cancelBtn.addEventListener("click", () => this.cancelTask(taskId));

    this.recentList.prepend(row);

    this.activeTasks.set(taskId, {
      payload,
      metadata,
      rowEl: row,
      barEl: row.querySelector(`#bar-${taskId}`),
      txtEl: row.querySelector(`#txt-${taskId}`),
      stEl: row.querySelector(`#st-${taskId}`),
      eventSource: null,
    });
  }

  listenTaskProgress(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const es = new EventSource(`/api/progress/${taskId}`);
    task.eventSource = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const pct = data.progress_percent || 0;

        if (task.barEl) task.barEl.style.width = `${pct}%`;
        if (task.txtEl) {
          const speed = data.speed ? ` · ${data.speed}` : "";
          task.txtEl.textContent = `${pct}%${speed}`;
        }

        if (data.status === "completed") {
          es.close();
          this.markTaskCompleted(taskId, data);
        } else if (data.status === "failed") {
          es.close();
          this.markTaskFailed(taskId, data.error);
        }
      } catch (err) {
        console.warn("[SSE] Parse error:", err);
      }
    };

    es.onerror = () => {};
  }

  markTaskCompleted(taskId, data) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    this.activeTasks.delete(taskId);
    this.completedTasks.push(data);

    const row = task.rowEl;
    if (row) {
      if (task.stEl) {
        task.stEl.className = "st ok";
        task.stEl.innerHTML = `<svg class="i"><use href="#check"/></svg>Concluído`;
      }

      // Substitui botão de cancelar por botão de abrir pasta
      const btn = row.querySelector(".btn-cancel-task");
      if (btn) {
        btn.className = "ib btn-open-folder";
        btn.setAttribute("aria-label", "Abrir pasta de destino");
        btn.innerHTML = `<svg class="i"><use href="#folder"/></svg>`;
        btn.onclick = () => this.openDestinationFolder();
      }
    }

    this.showToast(`Download de "${task.metadata.title}" concluído!`, "success");
    this.loadHistory();
    this.loadStorageTelemetry();
  }

  markTaskFailed(taskId, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    this.activeTasks.delete(taskId);

    const row = task.rowEl;
    if (row && task.stEl) {
      task.stEl.className = "st err";
      task.stEl.innerHTML = `<svg class="i"><use href="#x"/></svg>Erro`;
    }

    this.showToast(`Falha no download: ${error || "Erro desconhecido"}`, "error");
  }

  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task && task.eventSource) {
      task.eventSource.close();
    }
    this.activeTasks.delete(taskId);
    const row = document.getElementById(`row-task-${taskId}`);
    if (row) row.remove();
    this.showToast("Download cancelado", "warning");
  }

  async openDestinationFolder() {
    try {
      if (window.electronAPI && typeof window.electronAPI.revealDownloadPath === "function") {
        await window.electronAPI.revealDownloadPath();
        this.showToast("Pasta aberta no gerenciador de arquivos", "success");
      } else {
        const res = await fetch("/api/open-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success) {
          this.showToast("Pasta aberta no gerenciador de arquivos", "success");
        } else {
          this.showToast(data.error || "Não foi possível abrir a pasta", "warning");
        }
      }
    } catch (e) {
      this.showToast("Erro ao abrir pasta", "error");
    }
  }

  // --------------------------------------------------------------------------
  // Histórico de Downloads
  // --------------------------------------------------------------------------
  async loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.success && data.history && this.libraryList) {
        this.renderHistory(data.history);
      }
    } catch (e) {
      console.warn("[UI] Falha ao carregar histórico:", e);
    }
  }

  renderHistory(items) {
    if (!this.historyModalInstance) {
      this.historyModalInstance = new HistoryModal({
        modalElement: this.modalLibrary,
        listElement: this.libraryList,
        onToast: (msg, type) => this.showToast(msg, type),
        onReload: () => {
          this.loadHistory();
          this.loadStorageTelemetry();
        },
      });
    }
    this.historyModalInstance.render(items);
  }

  // --------------------------------------------------------------------------
  // Modais & Toasts
  // --------------------------------------------------------------------------
  openModal(modal) {
    if (!modal) return;
    modal.classList.add("active");
  }

  closeModals() {
    document.querySelectorAll(".modal-backdrop").forEach((m) => m.classList.remove("active"));
  }

  showToast(message, type = "success") {
    if (!this.toast) return;
    this.toastMsg.textContent = message;
    this.toast.className = `toast ${type} active`;
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.toast.classList.remove("active");
    }, 3500);
  }

  // --------------------------------------------------------------------------
  // Window Actions (Nativas via IPC / Desktop Runner / Fallback)
  // --------------------------------------------------------------------------
  async handleWindowAction(action) {
    try {
      if (action === "minimize") {
        minimizeWindow().catch(() => {});
      } else if (action === "maximize") {
        await maximizeWindow();
      } else if (action === "close") {
        closeWindow().catch(() => {});
      } else if (action === "start_drag") {
        await startWindowDrag();
      }
    } catch (e) {
      console.warn(`[UI] Erro ao executar ação de janela :`, e);
    }
  }
}

export const uiController = new UIController();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    uiController.init();
  });
} else {
  uiController.init();
}
