/**
 * VITROLA - CONTROLADOR DE INTERFACE (ui-controller.js)
 * Orquestração de eventos, busca com yt-dlp, telemetria de disco, fila reativa,
 * vinil interativo (VinylDisc), leitura do clipboard IPC e modo original de download.
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
import { VinylDisc } from "../components/VinylDisc.js";
import { ErrorModal } from "../components/ErrorModal.js";
import { RecentDownloads } from "../components/RecentDownloads.js";

// Interceptor transparente de URL e resiliência de rede para Electron / PySide
if (!window.__vitrola_api_interceptor_installed) {
  window.__vitrola_api_interceptor_installed = true;
  const getBackendBase = () => {
    if (window.electronAPI && typeof window.electronAPI.getBackendUrlSync === "function") {
      return window.electronAPI.getBackendUrlSync();
    }
    return "http://127.0.0.1:8765";
  };

  const originalFetch = window.fetch;
  window.fetch = async function (resource, init) {
    if (typeof resource === "string" && resource.startsWith("/api/")) {
      const base = window.location.protocol.startsWith("http") ? "" : getBackendBase();
      resource = base + resource;
    } else if (resource instanceof Request && resource.url.startsWith("file:///api/")) {
      const base = getBackendBase();
      const newUrl = resource.url.replace("file:///api/", `${base}/api/`);
      resource = new Request(newUrl, resource);
    }
    return originalFetch.call(this, resource, init);
  };

  const OriginalEventSource = window.EventSource;
  window.EventSource = function (url, configuration) {
    if (typeof url === "string" && url.startsWith("/api/")) {
      const base = window.location.protocol.startsWith("http") ? "" : getBackendBase();
      url = base + url;
    }
    return new OriginalEventSource(url, configuration);
  };
}

/**
 * Health check resiliente com até 3 tentativas (intervalo 500ms) contra a porta do backend
 */
export async function fetchWithHealthRetry(url, options = {}, maxRetries = 3, intervalMs = 500) {
  let lastError = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  }
  throw lastError;
}

class UIController {
  constructor() {
    this.currentInspection = null;
    this.currentUrl = "";
    this.activeMode = "audio"; // "audio" | "video"
    this.audioFormat = "Original";
    this.audioBitrate = 320;
    this.videoFormat = "Original";
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

    // Vinil Interativo com Arraste Polar
    this.vinylDisc = new VinylDisc();
    this.vinylDisc.mount(document.querySelector(".disc"));

    // Modal de Diagnóstico de Erros
    this.errorModal = new ErrorModal({
      onRetry: (taskId) => this.retryTask(taskId),
      onToast: (msg, type) => this.showToast(msg, type),
    });
    this.errorModal.mount();

    // Gerenciador com Delegação de Cliques em Downloads Recentes
    this.recentDownloads = new RecentDownloads({
      onInfo: (taskId) => this.openErrorDetails(taskId),
      onRetry: (taskId) => this.retryTask(taskId),
      onCancel: (taskId) => this.cancelTask(taskId),
    });
    this.recentDownloads.mount(document.getElementById("recent-downloads-list"));
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
    this.chipsAudioQ = document.querySelectorAll(".chips-audio-q [data-bitrate]");
    this.chipsVideoFmt = document.querySelectorAll(".chips-video-fmt span");
    this.chipsVideoRes = document.querySelectorAll(".chips-video-res [data-res]");
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

    // Debounce no input de busca para URLs completas coladas ou digitadas (350ms)
    if (this.inputUrl) {
      let debounceTimer = null;
      this.inputUrl.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const val = this.inputUrl.value.trim();
        if (val.startsWith("http://") || val.startsWith("https://")) {
          debounceTimer = setTimeout(() => {
            if (this.inputUrl.value.trim() === val && val !== this.currentUrl) {
              this.inspectCurrentUrl();
            }
          }, 350);
        }
      });
    }

    // Delegated click listener para #btn-paste resistente a mutações dinâmicas do DOM
    document.addEventListener("click", (e) => {
      const pasteBtn = e.target && e.target.closest ? e.target.closest("#btn-paste") : null;
      if (pasteBtn) {
        e.preventDefault();
        this.pasteFromClipboard();
      }
    });

    // Segmented Mode Toggle (Áudio vs Vídeo)
    this.segBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.m;
        this.setMode(mode);
      });
    });

    // Audio format chips (Original prioritário, MP3, Opus, M4A)
    this.chipsAudioFmt.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsAudioFmt.forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        this.audioFormat = chip.dataset.fmt || chip.textContent.trim();
        const isOriginal = this.audioFormat.toLowerCase() === "original";
        this.mediaSearchCard.setOriginalMode("audio", isOriginal);
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

    // Video format chips (Original prioritário, MP4, WebM, MKV)
    this.chipsVideoFmt.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsVideoFmt.forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        this.videoFormat = chip.dataset.fmt || chip.textContent.trim();
        const isOriginal = this.videoFormat.toLowerCase() === "original";
        this.mediaSearchCard.setOriginalMode("video", isOriginal);
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
      this.btnViewAllHistory.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigateView("history");
      });
    }

    // Modal close backdrops e botões de fechamento (X / .btn-close-modal)
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop || e.target.closest(".btn-close-modal") || e.target.closest(".x")) {
          this.navigateView("home");
        }
      });
    });

    // Tecla Escape para fechamento global de modais e restauração determinística para Início
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Esc") {
        const hasOpenModal = document.querySelector(".modal-backdrop.active");
        if (hasOpenModal) {
          e.preventDefault();
          this.navigateView("home");
        }
      }
    });

    // Settings yt-dlp triggers
    if (this.btnCheckYtdlp) {
      this.btnCheckYtdlp.addEventListener("click", () => ytdlpManager.triggerCheck());
    }
    if (this.btnUpdateYtdlp) {
      this.btnUpdateYtdlp.addEventListener("click", () => ytdlpManager.triggerUpdate());
    }
  }

  syncSidebarIndicators(currentActiveId) {
    if (this.sidebar && typeof this.sidebar.syncSidebarIndicators === "function") {
      this.sidebar.syncSidebarIndicators(currentActiveId);
    }
  }

  navigateView(targetView, options = {}) {
    const view = (targetView || "home").toString().toLowerCase();
    if (view === "settings" || view === "modal-settings") {
      if (this.modalLibrary) this.modalLibrary.classList.remove("active");
      if (this.errorModal && typeof this.errorModal.close === "function") this.errorModal.close();
      this.openModal(this.modalSettings);
      this.syncSidebarIndicators("settings");
    } else if (view === "history" || view === "modal-history" || view === "library") {
      if (this.modalSettings) this.modalSettings.classList.remove("active");
      if (this.errorModal && typeof this.errorModal.close === "function") this.errorModal.close();
      this.loadHistory();
      this.openModal(this.modalLibrary);
      this.syncSidebarIndicators("history");
    } else {
      this.closeModals();
      this.syncSidebarIndicators("home");
    }
  }

  handleViewChange(view) {
    this.navigateView(view);
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
    if (this._pasting && Date.now() - this._pasting < 250) return;
    this._pasting = Date.now();

    try {
      let text = "";
      if (window.electronAPI) {
        if (typeof window.electronAPI.readClipboard === "function") {
          text = await window.electronAPI.readClipboard();
        } else if (typeof window.electronAPI.readClipboardText === "function") {
          text = await window.electronAPI.readClipboardText();
        } else if (window.electronAPI.clipboard && typeof window.electronAPI.clipboard.readText === "function") {
          text = await window.electronAPI.clipboard.readText();
        } else if (typeof window.electronAPI.clipboardReadText === "function") {
          text = await window.electronAPI.clipboardReadText();
        }
      }

      if (!text) {
        try {
          const res = await fetch("/api/clipboard");
          const data = await res.json();
          if (data && data.text) text = data.text;
        } catch (_) {}
      }

      if (!text && navigator.clipboard && navigator.clipboard.readText) {
        try {
          text = await navigator.clipboard.readText();
        } catch (_) {}
      }

      text = (text || "").trim();
      if (!text) {
        this.showToast("Área de transferência vazia", "warning");
        return;
      }

      this.inputUrl.value = text;
      this.inputUrl.dispatchEvent(new Event("input", { bubbles: true }));
      this.inputUrl.focus();

      const isUrl = /^https?:\/\//i.test(text);
      if (isUrl) {
        this.showToast("Link colado da área de transferência", "success");
        this.inspectCurrentUrl();
      } else {
        this.showToast("Texto colado no campo de busca", "success");
      }
    } catch (err) {
      console.warn("[UI] Falha no clipboard:", err);
      this.showToast("Acesso à área de transferência restrito", "warning");
    }
  }

  // --------------------------------------------------------------------------
  // Inspeção de Mídia & Skeleton Shimmer
  // --------------------------------------------------------------------------
  async inspectCurrentUrl() {
    const url = this.inputUrl.value.trim();
    if (!url) return;

    this.currentUrl = url;
    this.mediaSearchCard.setState("fetching-skeleton");
    this.btnSearch.disabled = true;

    try {
      const res = await fetchWithHealthRetry("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.success && data.metadata) {
        this.currentInspection = data;
        this.populateCard(data);
        this.mediaSearchCard.setState("metadata-ready");
      } else {
        this.showToast(data.error || "URL inválida ou não suportada", "error");
        this.mediaSearchCard.setState("error");
      }
    } catch (err) {
      this.showToast(`Erro ao conectar com o serviço: ${err.message}`, "error");
      this.mediaSearchCard.setState("error");
    } finally {
      this.btnSearch.disabled = false;
    }
  }

  populateCard(data) {
    const meta = data.metadata;
    this.cardTitle.textContent = meta.title || "Mídia sem título";
    this.cardBy.textContent = meta.uploader || meta.artist || meta.channel || "";

    const durationStr = meta.duration_formatted || meta.duration_str || "";
    this.cardDur.textContent = durationStr;

    const views = meta.view_count ? Number(meta.view_count).toLocaleString("pt-BR") : "";
    if (this.cardStats) {
      this.cardStats.textContent = views ? `${views} visualizações` : "";
    }
    if (this.cardPlatform) {
      this.cardPlatform.textContent = meta.extractor || "";
    }

    // Thumbnail no mockup de vinil (.sleeve)
    if (meta.thumbnail && this.cardThumb) {
      this.cardThumb.innerHTML = `<img src="${meta.thumbnail}" alt="Thumbnail" loading="lazy">${durationStr ? `<em id="card-dur">${durationStr}</em>` : ""}`;
    }

    if (meta.is_music_track && !meta.has_real_video) {
      this.setMode("audio");
    } else {
      this.setMode(this.activeMode || "audio");
    }

    // Sincroniza estado de qualidade original com metadados reais sondados
    const isOriginalAudio = this.audioFormat.toLowerCase() === "original";
    const origAudio = data.originalAudio || meta.originalAudio;
    this.mediaSearchCard.updateQualityBadgeDisplay(isOriginalAudio, origAudio);

    const isOriginalVideo = this.videoFormat.toLowerCase() === "original";
    const origVideo = data.originalVideo || meta.originalVideo;
    this.mediaSearchCard.updateVideoQualityBadgeDisplay(isOriginalVideo, origVideo);

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

    const meta = this.currentInspection.metadata;
    const dur = meta.duration || 240;

    // Áudio
    if (this.audioFormat.toLowerCase() === "original") {
      const rawSize = meta.filesize_formatted || (meta.filesize ? `${(meta.filesize / (1024 * 1024)).toFixed(1)} MB` : "Original (Fonte)");
      if (this.lblSizeA) this.lblSizeA.textContent = rawSize;
    } else {
      const kbps = this.audioBitrate || 320;
      const bytesA = (kbps * 1000 * dur) / 8;
      const mbA = (bytesA / (1024 * 1024)).toFixed(1).replace(".", ",");
      if (this.lblSizeA) this.lblSizeA.textContent = `≈ ${mbA} MB`;
    }

    // Vídeo
    if (this.videoFormat.toLowerCase() === "original") {
      const rawSize = meta.filesize_formatted || (meta.filesize ? `${(meta.filesize / (1024 * 1024)).toFixed(1)} MB` : "Original (Fonte)");
      if (this.lblSizeV) this.lblSizeV.textContent = rawSize;
    } else {
      let factor = 0.25;
      if (this.videoRes.includes("720")) factor = 0.15;
      else if (this.videoRes.includes("480")) factor = 0.08;
      else if (this.videoRes.includes("360")) factor = 0.05;

      const approxMbV = Math.max(2, Math.round(dur * factor));
      if (this.lblSizeV) this.lblSizeV.textContent = `≈ ${approxMbV} MB`;
    }
  }

  // --------------------------------------------------------------------------
  // Início de Download
  // --------------------------------------------------------------------------
  async startDownload() {
    if (!this.currentInspection || !this.currentUrl) return;

    const isOriginal = (this.activeMode === "audio" && this.audioFormat.toLowerCase() === "original") ||
                       (this.activeMode === "video" && this.videoFormat.toLowerCase() === "original");

    const payload = {
      url: this.currentUrl,
      mode: this.activeMode,
      title: this.currentInspection.metadata.title,
      format: this.activeMode === "audio" ? this.audioFormat : this.videoFormat,
      format_id: null,
      is_original_quality: isOriginal,
      isOriginalQuality: isOriginal,
      target_res: parseInt(this.videoRes, 10) || 1080,
      embed_metadata: this.embedMetadata,
      embed_thumbnail: true,
      embed_subtitles: this.embedSubtitles,
    };

    if (!isOriginal && this.activeMode === "audio" && this.currentInspection.audio_streams) {
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

    const isOriginal = payload.is_original_quality;
    const tagText = isOriginal
      ? (payload.mode === "audio" ? "Áudio Original" : "Vídeo Original")
      : (payload.mode === "audio" ? `${payload.format} ${this.audioBitrate} kbps` : `${payload.format} ${payload.target_res}p`);

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
      <div class="row-actions" id="act-${taskId}">
        <button class="ib btn-cancel-task" data-task-id="${taskId}" aria-label="Cancelar download">
          <svg class="i"><use href="#x"/></svg>
        </button>
      </div>
    `;

    const cancelBtn = row.querySelector(".btn-cancel-task");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.cancelTask(taskId));
    }

    this.recentList.prepend(row);

    this.activeTasks.set(taskId, {
      payload,
      metadata,
      rowEl: row,
      barEl: row.querySelector(`#bar-${taskId}`),
      txtEl: row.querySelector(`#txt-${taskId}`),
      stEl: row.querySelector(`#st-${taskId}`),
      eventSource: null,
      isFailed: false,
    });
  }

  listenTaskProgress(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    if (task.eventSource) {
      task.eventSource.close();
    }

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

    if (task.eventSource) {
      try {
        task.eventSource.close();
      } catch (_) {}
      task.eventSource = null;
    }

    const taskTitle = (data && data.title) || (task.metadata && task.metadata.title) || "mídia";

    // Expurgar buffers e referências residuais de imagem e mídia
    if (task.metadata) {
      task.metadata.thumbnail_buffer = null;
      task.metadata.raw_data = null;
      task.metadata = null;
    }

    this.activeTasks.delete(taskId);
    this.completedTasks.push(data);

    const row = task.rowEl;
    if (row) {
      if (task.stEl) {
        task.stEl.className = "st ok";
        task.stEl.innerHTML = `<svg class="i"><use href="#check"/></svg>Concluído`;
      }

      const actCol = row.querySelector(`#act-${taskId}`) || row.querySelector(".row-actions");
      if (actCol) {
        actCol.innerHTML = `
          <button class="ib btn-open-folder" aria-label="Abrir pasta de destino">
            <svg class="i"><use href="#folder"/></svg>
          </button>
        `;
        const openBtn = actCol.querySelector(".btn-open-folder");
        if (openBtn) {
          openBtn.onclick = () => this.openDestinationFolder();
        }
      }
    }

    this.showToast(`Download de "${taskTitle}" concluído!`, "success");
    this.loadHistory();
    this.loadStorageTelemetry();
  }

  markTaskFailed(taskId, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.isFailed = true;

    const row = task.rowEl;
    if (row && task.stEl) {
      task.stEl.className = "st err";
      task.stEl.innerHTML = `
        <svg class="i"><use href="#x"/></svg>
        <span>Erro</span>
        <button type="button" class="ib btn-error-info" data-task-id="${taskId}" title="Ver detalhes da falha">
          <svg class="i"><use href="#info"/></svg>
        </button>
      `;

      const infoBtn = task.stEl.querySelector(".btn-error-info");
      if (infoBtn) {
        infoBtn.addEventListener("click", () => this.openErrorDetails(taskId));
      }
    }

    const actCol = row ? (row.querySelector(`#act-${taskId}`) || row.querySelector(".row-actions")) : null;
    if (actCol) {
      actCol.innerHTML = `
        <button type="button" class="ib btn-retry-task" data-task-id="${taskId}" title="Tentar novamente">
          <svg class="i"><use href="#retry"/></svg>
        </button>
        <button type="button" class="ib btn-cancel-task" data-task-id="${taskId}" aria-label="Remover">
          <svg class="i"><use href="#trash"/></svg>
        </button>
      `;

      const retryBtn = actCol.querySelector(".btn-retry-task");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => this.retryTask(taskId));
      }

      const cancelBtn = actCol.querySelector(".btn-cancel-task");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => this.cancelTask(taskId));
      }
    }

    this.showToast(`Falha no download: ${error || "Erro no processamento"}`, "error");
  }

  async openErrorDetails(taskId) {
    let details = null;
    try {
      if (window.electronAPI && typeof window.electronAPI.getErrorDetails === "function") {
        details = await window.electronAPI.getErrorDetails(taskId);
      }
    } catch (_) {}

    if (!details) {
      try {
        const res = await fetch(`/api/download/error-details?taskId=${encodeURIComponent(taskId)}`);
        const json = await res.json();
        if (json && json.success && json.error_details) {
          details = json.error_details;
        }
      } catch (_) {}
    }

    const task = this.activeTasks.get(taskId);
    const mediaTitle = task?.title || details?.mediaTitle || "Mídia Desconhecida";

    if (!details) {
      details = {
        taskId,
        mediaTitle,
        message: "Ocorreu uma falha durante o processamento da mídia.",
        rawLog: "Nenhum detalhe técnico adicional arquivado.",
        suggestedAction: "Clique em 'Tentar Novamente' para reiniciar a extração.",
        timestamp: new Date().toISOString(),
        isThumbnailError: false
      };
    } else {
      details.taskId = taskId;
      details.mediaTitle = details.mediaTitle || mediaTitle;
      details.message = details.message || details.summary || "Falha no download da mídia.";
      details.rawLog = details.rawLog || details.rawErrorLog || details.raw_log || "";
      details.timestamp = details.timestamp || new Date().toISOString();
      if (!details.httpStatus && (details.rawLog.includes("416") || details.message.includes("416"))) {
        details.httpStatus = 416;
      }
    }

    this.errorModal.openErrorModal(details, (tid) => this.retryTask(tid));
  }

  async retryTask(taskId) {
    const task = this.activeTasks.get(taskId);
    const row = task ? task.rowEl : document.getElementById(`row-task-${taskId}`);

    if (row) {
      const stEl = row.querySelector(`#st-${taskId}`);
      if (stEl) {
        stEl.className = "st";
        stEl.innerHTML = `
          <span class="bar"><i id="bar-${taskId}" style="width: 0%"></i></span>
          <span id="txt-${taskId}">Reiniciando...</span>
        `;
        if (task) {
          task.barEl = stEl.querySelector(`#bar-${taskId}`);
          task.txtEl = stEl.querySelector(`#txt-${taskId}`);
        }
      }

      const actCol = row.querySelector(`#act-${taskId}`) || row.querySelector(".row-actions");
      if (actCol) {
        actCol.innerHTML = `
          <button class="ib btn-cancel-task" data-task-id="${taskId}" aria-label="Cancelar download">
            <svg class="i"><use href="#x"/></svg>
          </button>
        `;
        const cancelBtn = actCol.querySelector(".btn-cancel-task");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => this.cancelTask(taskId));
        }
      }
    }

    if (task) {
      task.isFailed = false;
    }

    this.showToast("Reexecutando download...", "info");

    try {
      let resData = null;
      if (window.electronAPI && typeof window.electronAPI.retryTask === "function") {
        resData = await window.electronAPI.retryTask(taskId);
      } else {
        const res = await fetch("/api/download/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, suppressThumbnail: true }),
        });
        resData = await res.json();
      }

      if (resData && resData.success) {
        this.listenTaskProgress(taskId);
      } else {
        this.markTaskFailed(taskId, resData?.error || "Falha ao reiniciar tarefa");
      }
    } catch (err) {
      this.markTaskFailed(taskId, err.message);
    }
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
    this.syncSidebarIndicators("home");
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
      console.warn(`[UI] Erro ao executar ação de janela '${action}':`, e);
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
