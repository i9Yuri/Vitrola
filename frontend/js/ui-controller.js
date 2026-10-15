/**
 * MARÉ - CONTROLADOR DE INTERFACE (ui-controller.js)
 * Orquestração de eventos, busca com yt-dlp, fila reativa e waveform.
 */

import { themeManager } from "./theme-manager.js";
import { ytdlpManager } from "./ytdlp-manager.js";
import { minimizeWindow, maximizeWindow, closeWindow } from "../../main/ipc/window-controls.js";
import { selectDirectory } from "../../main/ipc/filesystem-handler.js";
import { HistoryModal } from "../components/HistoryModal.js";

// Pseudo-random deterministic generator for waveforms
function createRng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

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
    this.activeTasks = new Map(); // taskId -> { data, eventSource, seed }
    this.completedTasks = [];
    this.config = null;
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.initThemes();
    this.initYtDlp();
    this.loadConfig();
    this.loadHistory();
    this.setupGlobalPaste();
  }

  cacheDom() {
    // Window controls
    this.btnMin = document.getElementById("btn-win-min");
    this.btnMax = document.getElementById("btn-win-max");
    this.btnClose = document.getElementById("btn-win-close");

    // Nav & Sidebar
    this.navBtns = document.querySelectorAll(".nav button");
    this.navQueueCount = document.getElementById("nav-queue-count");
    this.btnDest = document.getElementById("btn-dest");
    this.destPath = document.getElementById("dest-path");
    this.sidebarEngine = document.getElementById("sidebar-engine");
    this.engineStatusText = document.getElementById("engine-status-text");

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
    this.cardStats = document.getElementById("card-stats");
    this.modeTiles = document.querySelectorAll(".tile[data-mode]");
    this.chipsAudioFmt = document.querySelectorAll(".chip-audio-fmt");
    this.chipsAudioQ = document.querySelectorAll(".chip-audio-q");
    this.chipsVideoFmt = document.querySelectorAll(".chip-video-fmt");
    this.chipsVideoRes = document.querySelectorAll(".chip-video-res");
    this.swAudioMeta = document.getElementById("sw-audio-meta");
    this.swVideoSubs = document.getElementById("sw-video-subs");
    this.lblSize = document.getElementById("lbl-size");
    this.btnGo = document.getElementById("btn-go");

    // Queue
    this.queueList = document.getElementById("queue-list");
    this.queueCountHeader = document.getElementById("queue-count-header");
    this.btnPauseAll = document.getElementById("btn-pause-all");
    this.btnClearDone = document.getElementById("btn-clear-done");

    // Modals
    this.modalSettings = document.getElementById("modal-settings");
    this.modalLibrary = document.getElementById("modal-library");
    this.libraryList = document.getElementById("library-list");
    this.modalDest = document.getElementById("modal-dest");
    this.destModalPath = document.getElementById("dest-modal-path");
    this.btnDestOpenFolder = document.getElementById("btn-dest-open-folder");
    this.btnDestChangeFolder = document.getElementById("btn-dest-change-folder");
    this.toast = document.getElementById("toast");
    this.toastMsg = document.getElementById("toast-msg");

    // Settings Modal controls
    this.themeBtns = document.querySelectorAll(".theme-btn");
    this.accentBtns = document.querySelectorAll(".accent-btn");
    this.ytdlpVersionBadge = document.getElementById("ytdlp-version-badge");
    this.btnCheckYtdlp = document.getElementById("btn-check-ytdlp");
    this.btnUpdateYtdlp = document.getElementById("btn-update-ytdlp");
    this.ytdlpLogs = document.getElementById("ytdlp-logs");
  }

  bindEvents() {
    // Window controls
    if (this.btnMin) this.btnMin.addEventListener("click", () => this.handleWindowAction("minimize"));
    if (this.btnMax) this.btnMax.addEventListener("click", () => this.handleWindowAction("maximize"));
    if (this.btnClose) this.btnClose.addEventListener("click", () => this.handleWindowAction("close"));

    // Nav selection
    this.navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view === "settings") {
          this.openModal(this.modalSettings);
        } else if (view === "history" || view === "library") {
          this.loadHistory();
          this.openModal(this.modalLibrary);
        } else {
          this.navBtns.forEach((b) => b.removeAttribute("aria-current"));
          btn.setAttribute("aria-current", "page");
          this.closeModals();
        }
      });
    });

    // Destination folder modal & actions
    if (this.btnDest) {
      this.btnDest.addEventListener("click", () => this.openDestModal());
    }
    if (this.btnDestOpenFolder) {
      this.btnDestOpenFolder.addEventListener("click", () => {
        this.openDestinationFolder();
        this.closeModals();
      });
    }
    if (this.btnDestChangeFolder) {
      this.btnDestChangeFolder.addEventListener("click", () => this.changeDestinationFolder());
    }

    // Engine badge click -> open Settings
    if (this.sidebarEngine) {
      this.sidebarEngine.addEventListener("click", () => this.openModal(this.modalSettings));
    }

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

    // Mode tiles (Áudio vs Vídeo)
    this.modeTiles.forEach((tile) => {
      tile.addEventListener("click", () => this.setMode(tile.dataset.mode));
    });

    // Audio format chips
    this.chipsAudioFmt.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsAudioFmt.forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        this.audioFormat = chip.dataset.format || chip.textContent.trim();
        this.recalcEstimatedSize();
      });
    });

    // Audio quality chips
    this.chipsAudioQ.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsAudioQ.forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        this.audioBitrate = parseInt(chip.dataset.bitrate, 10) || 320;
        this.recalcEstimatedSize();
      });
    });

    // Video format chips
    this.chipsVideoFmt.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsVideoFmt.forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        this.videoFormat = chip.dataset.format || chip.textContent.trim();
        this.recalcEstimatedSize();
      });
    });

    // Video res chips
    this.chipsVideoRes.forEach((chip) => {
      chip.addEventListener("click", () => {
        this.chipsVideoRes.forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        this.videoRes = chip.dataset.res || chip.textContent.trim();
        this.recalcEstimatedSize();
      });
    });

    // Switches
    if (this.swAudioMeta) {
      this.swAudioMeta.addEventListener("click", () => {
        const val = this.swAudioMeta.getAttribute("aria-checked") === "true";
        this.swAudioMeta.setAttribute("aria-checked", String(!val));
        this.embedMetadata = !val;
      });
    }

    if (this.swVideoSubs) {
      this.swVideoSubs.addEventListener("click", () => {
        const val = this.swVideoSubs.getAttribute("aria-checked") === "true";
        this.swVideoSubs.setAttribute("aria-checked", String(!val));
        this.embedSubtitles = !val;
      });
    }

    // Go / Download trigger
    if (this.btnGo) {
      this.btnGo.addEventListener("click", () => this.startDownload());
    }

    // Queue buttons
    if (this.btnPauseAll) {
      this.btnPauseAll.addEventListener("click", () => this.cancelAllDownloads());
    }

    if (this.btnClearDone) {
      this.btnClearDone.addEventListener("click", () => this.clearCompletedDownloads());
    }

    // Modal close backdrops
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop || e.target.closest(".btn-close-modal")) {
          this.closeModals();
        }
      });
    });

    // Settings theme buttons
    this.themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        themeManager.setThemeMode(mode);
        this.syncThemeUI();
      });
    });

    // Settings accent buttons
    this.accentBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const color = btn.dataset.color;
        themeManager.setAccentColor(color);
        this.syncThemeUI();
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

  // --------------------------------------------------------------------------
  // Temas & UI
  // --------------------------------------------------------------------------
  initThemes() {
    themeManager.apply();
    this.syncThemeUI();
  }

  syncThemeUI() {
    const prefs = themeManager.getPreferences();
    this.themeBtns.forEach((btn) => {
      const mode = btn.dataset.mode;
      const isActive =
        (mode === "dark-amoled" && (prefs.themeMode === "dark-amoled" || prefs.darkVariant === "amoled")) ||
        (mode === "light" && prefs.themeMode === "light") ||
        (mode === "dark" && prefs.themeMode === "dark" && prefs.darkVariant !== "amoled");
      btn.setAttribute("aria-checked", String(isActive));
    });

    this.accentBtns.forEach((btn) => {
      const col = btn.dataset.color;
      const isActive = (prefs.accentColor || "default") === col;
      btn.setAttribute("aria-checked", String(isActive));
    });
  }

  initYtDlp() {
    ytdlpManager.subscribe((state) => {
      if (this.engineStatusText) {
        if (state.status === "checking") {
          this.engineStatusText.textContent = "Verificando...";
        } else if (state.status === "updating") {
          this.engineStatusText.textContent = "Atualizando yt-dlp...";
        } else if (state.status === "available") {
          this.engineStatusText.textContent = `v${state.latestVersion} disp.!`;
        } else if (state.currentVersion && state.currentVersion !== "carregando...") {
          this.engineStatusText.textContent = `yt-dlp v${state.currentVersion}`;
        } else {
          this.engineStatusText.textContent = "yt-dlp em dia";
        }
      }

      if (this.sidebarEngine) {
        this.sidebarEngine.className = `engine ${state.status}`;
      }

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
  // Config & Pastas
  // --------------------------------------------------------------------------
  async loadConfig() {
    try {
      // Migração suave de configurações legadas no localStorage se presentes
      try {
        const legacyMF = localStorage.getItem("mediaforge_config") || localStorage.getItem("fita_config");
        if (legacyMF && !localStorage.getItem("mare_config")) {
          localStorage.setItem("mare_config", legacyMF);
        }
      } catch (_) {}

      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.success && data.config) {
        this.config = data.config;
        const dir = data.config.effective_download_dir || data.config.storage?.download_dir || "~/Música/Maré";
        if (this.destPath) {
          this.destPath.textContent = dir.replace(/\/home\/[^/]+/, "~");
          this.destPath.title = dir;
        }
      }
    } catch (err) {
      console.warn("[UI] Falha ao carregar configuração:", err);
    }
  }

  async openDestinationFolder() {
    try {
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
    } catch (e) {
      this.showToast("Erro ao abrir pasta", "error");
    }
  }

  openDestModal() {
    const current = this.destPath?.title || "~/Música/Maré";
    if (this.destModalPath) this.destModalPath.textContent = current;
    this.openModal(this.modalDest);
  }

  async changeDestinationFolder() {
    try {
      const res = await selectDirectory(this.config?.effective_download_dir);
      if (!res.canceled && (res.path || res.selectedPath)) {
        const newPath = res.path || res.selectedPath;
        if (this.destPath) {
          this.destPath.textContent = newPath.replace(/\/home\/[^/]+/, "~");
          this.destPath.title = newPath;
        }
        if (this.destModalPath) {
          this.destModalPath.textContent = newPath;
        }
        this.showToast(`Pasta de destino alterada: ${newPath}`, "success");
        this.closeModals();
      }
    } catch (e) {
      this.showToast("Falha ao alterar pasta de destino", "error");
    }
  }

  // --------------------------------------------------------------------------
  // Atalhos Globais e Paste
  // --------------------------------------------------------------------------
  setupGlobalPaste() {
    window.addEventListener("keydown", async (e) => {
      // Ctrl+V ou Cmd+V fora de inputs
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
    this.cardStats.textContent = `${views} visualizações • ${meta.is_live ? "Transmissão ao vivo" : "Duração: " + durationStr}`;

    // Thumbnail
    if (meta.thumbnail) {
      this.cardThumb.innerHTML = `<img src="${meta.thumbnail}" alt="Thumbnail" loading="lazy"><span class="dur">${durationStr}</span>`;
    }

    // Auto-detect se é áudio puro (ex: YouTube Music)
    if (meta.is_music_track && !meta.has_real_video) {
      this.setMode("audio");
      this.modeTiles.forEach((t) => {
        if (t.dataset.mode === "video") t.style.opacity = "0.5";
      });
    } else {
      this.modeTiles.forEach((t) => (t.style.opacity = "1"));
      this.setMode(this.activeMode || "audio");
    }

    this.recalcEstimatedSize();
  }

  setMode(mode) {
    this.activeMode = mode;
    this.card.setAttribute("data-mode", mode);
    this.modeTiles.forEach((tile) => {
      tile.setAttribute("aria-checked", String(tile.dataset.mode === mode));
    });
    this.recalcEstimatedSize();
  }

  recalcEstimatedSize() {
    if (!this.currentInspection || !this.currentInspection.metadata) {
      if (this.lblSize) this.lblSize.textContent = "≈ -- MB";
      return;
    }

    const dur = this.currentInspection.metadata.duration || 240;

    if (this.activeMode === "audio") {
      // Bitrate em kbps (ex: 320, 256, 128)
      const kbps = this.audioBitrate || 320;
      const bytes = (kbps * 1000 * dur) / 8;
      const mb = (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");
      if (this.lblSize) this.lblSize.textContent = `≈ ${mb} MB`;
    } else {
      // Estimativa para vídeo com base na resolução
      let factor = 0.25; // MB por segundo base para 1080p
      if (this.videoRes.includes("720")) factor = 0.15;
      else if (this.videoRes.includes("480")) factor = 0.08;
      else if (this.videoRes.includes("360")) factor = 0.05;

      const approxMb = Math.max(2, Math.round(dur * factor));
      if (this.lblSize) this.lblSize.textContent = `≈ ${approxMb} MB`;
    }
  }

  // --------------------------------------------------------------------------
  // Início de Download & Streaming com Waveform
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

    // Mapear format_id específico se disponível
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
        this.showToast("Download adicionado à fila!", "success");
        this.createQueueItem(data.task_id, payload, this.currentInspection.metadata);
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

  createQueueItem(taskId, payload, metadata) {
    const seed = Math.floor(Math.random() * 100) + 1;
    const item = document.createElement("li");
    item.className = "dl";
    item.dataset.mode = payload.mode;
    item.id = `dl-task-${taskId}`;

    const tagText = payload.mode === "audio" ? `${payload.format} ${this.audioBitrate}` : `${payload.format} ${payload.target_res}p`;
    const thumbHtml = metadata.thumbnail
      ? `<img src="${metadata.thumbnail}" alt="Thumb" loading="lazy">`
      : `<div style="background:var(--raised);width:100%;height:100%"></div>`;

    item.innerHTML = `
      <div class="thumb">${thumbHtml}</div>
      <div class="dl-body">
        <div class="dl-top">
          <span class="dl-title" title="${metadata.title}">${metadata.title}</span>
          <span class="tag">${tagText}</span>
        </div>
        <div class="dl-sub">${metadata.uploader || "Mídia"}</div>
        <div class="wave" id="wave-${taskId}"></div>
        <div class="dl-meta">
          <b id="pct-${taskId}">0%</b>
          <span id="speed-${taskId}">Iniciando...</span>
          <span id="eta-${taskId}">--:--</span>
        </div>
      </div>
      <button class="x btn-cancel-task" data-task-id="${taskId}" aria-label="Cancelar download">
        <svg class="i"><use href="#i-x"/></svg>
      </button>
    `;

    // Renderizar forma de onda inicial (0%)
    const waveEl = item.querySelector(`#wave-${taskId}`);
    this.renderWaveform(waveEl, seed, 0);

    const cancelBtn = item.querySelector(".btn-cancel-task");
    cancelBtn.addEventListener("click", () => this.cancelTask(taskId));

    // Inserir no topo da fila
    const emptyEl = this.queueList.querySelector(".q-empty");
    if (emptyEl) emptyEl.remove();

    this.queueList.prepend(item);

    this.activeTasks.set(taskId, {
      payload,
      metadata,
      seed,
      itemEl: item,
      waveEl,
      pctEl: item.querySelector(`#pct-${taskId}`),
      speedEl: item.querySelector(`#speed-${taskId}`),
      etaEl: item.querySelector(`#eta-${taskId}`),
      eventSource: null,
    });

    this.updateQueueBadge();
  }

  // --------------------------------------------------------------------------
  // ALGORITMO DETERMINÍSTICO DA FORMA DE ONDA (Waveform Progress)
  // --------------------------------------------------------------------------
  renderWaveform(waveEl, seed, progressPercent) {
    if (!waveEl) return;
    const n = 44;
    const p = Math.max(0, Math.min(100, progressPercent)) / 100;
    const cut = Math.round(n * p);
    const r = createRng(seed);

    if (waveEl.children.length !== n) {
      waveEl.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const env = 0.55 + 0.45 * Math.sin((i / n) * Math.PI * 3.2 + seed);
        const h = Math.max(0.18, Math.min(1.0, env * (0.55 + 0.45 * r())));
        const bar = document.createElement("i");
        bar.style.height = Math.round(h * 100) + "%";
        waveEl.appendChild(bar);
      }
    }

    const bars = waveEl.children;
    for (let i = 0; i < n; i++) {
      if (i < cut) {
        bars[i].className = i === cut - 1 && p < 1 ? "on edge" : "on";
      } else {
        bars[i].className = "";
      }
    }

    waveEl.setAttribute("role", "progressbar");
    waveEl.setAttribute("aria-valuenow", String(Math.round(progressPercent)));
    waveEl.setAttribute("aria-valuemin", "0");
    waveEl.setAttribute("aria-valuemax", "100");
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

        if (task.pctEl) task.pctEl.textContent = `${pct}%`;
        if (task.speedEl) task.speedEl.textContent = data.speed || "Baixando...";
        if (task.etaEl) task.etaEl.textContent = data.eta ? `${data.eta}` : "";

        this.renderWaveform(task.waveEl, task.seed, pct);

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

    es.onerror = () => {
      // EventSource reconecta automaticamente
    };
  }

  markTaskCompleted(taskId, data) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    this.activeTasks.delete(taskId);
    this.completedTasks.push(data);
    this.updateQueueBadge();

    const item = task.itemEl;
    item.className = "dl done";
    item.dataset.mode = task.payload.mode;

    const finalSize = data.total_size || "Concluído";
    item.innerHTML = `
      <div class="thumb">${task.metadata.thumbnail ? `<img src="${task.metadata.thumbnail}" alt="Thumb">` : ""}</div>
      <div class="dl-body">
        <div class="dl-top">
          <span class="dl-title" title="${task.metadata.title}">${task.metadata.title}</span>
          <span class="ok"><svg class="i"><use href="#i-check"/></svg>${finalSize}</span>
        </div>
        <div class="dl-sub">${task.metadata.uploader || "Mídia"}, ${task.payload.format}</div>
      </div>
      <button class="x btn-open-folder" title="Abrir pasta de destino">
        <svg class="i"><use href="#i-folder"/></svg>
      </button>
    `;

    item.querySelector(".btn-open-folder").addEventListener("click", () => this.openDestinationFolder());
    this.showToast(`Download de "${task.metadata.title}" concluído!`, "success");
  }

  markTaskFailed(taskId, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    this.activeTasks.delete(taskId);
    this.updateQueueBadge();

    const item = task.itemEl;
    item.className = "dl failed";
    item.innerHTML = `
      <div class="thumb">${task.metadata.thumbnail ? `<img src="${task.metadata.thumbnail}" alt="Thumb">` : ""}</div>
      <div class="dl-body">
        <div class="dl-top">
          <span class="dl-title" title="${task.metadata.title}">${task.metadata.title}</span>
          <span class="tag" style="color:var(--danger)">Erro</span>
        </div>
        <div class="dl-sub">${error || "Falha na conversão ou download"}</div>
      </div>
      <button class="x btn-dismiss-task" title="Remover"><svg class="i"><use href="#i-x"/></svg></button>
    `;

    item.querySelector(".btn-dismiss-task").addEventListener("click", () => item.remove());
    this.showToast(`Falha no download: ${error || "Erro desconhecido"}`, "error");
  }

  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task && task.eventSource) {
      task.eventSource.close();
    }
    this.activeTasks.delete(taskId);
    const item = document.getElementById(`dl-task-${taskId}`);
    if (item) item.remove();
    this.updateQueueBadge();
    this.showToast("Download cancelado", "warning");
  }

  cancelAllDownloads() {
    this.activeTasks.forEach((task, id) => {
      if (task.eventSource) task.eventSource.close();
      if (task.itemEl) task.itemEl.remove();
    });
    this.activeTasks.clear();
    this.updateQueueBadge();
    this.showToast("Todos os downloads ativos foram pausados/cancelados", "warning");
  }

  clearCompletedDownloads() {
    const doneItems = this.queueList.querySelectorAll(".dl.done, .dl.failed");
    doneItems.forEach((i) => i.remove());
    if (this.queueList.children.length === 0) {
      this.queueList.innerHTML = `<li class="q-empty">Nenhum download na fila.</li>`;
    }
  }

  updateQueueBadge() {
    const count = this.activeTasks.size;
    if (this.navQueueCount) {
      this.navQueueCount.textContent = count;
      if (count > 0) {
        this.navQueueCount.classList.remove("hidden");
      } else {
        this.navQueueCount.classList.add("hidden");
      }
    }

    if (this.queueCountHeader) {
      this.queueCountHeader.textContent = count > 0 ? `${count} em andamento` : "Fila vazia";
    }
  }

  scrollToQueue() {
    const q = document.querySelector(".queue");
    if (q) q.scrollIntoView({ behavior: "smooth" });
  }

  // --------------------------------------------------------------------------
  // Biblioteca / Histórico
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
    if (action === "minimize") {
      await minimizeWindow();
    } else if (action === "maximize") {
      await maximizeWindow();
    } else if (action === "close") {
      await closeWindow();
    }
  }
}

export const uiController = new UIController();

// Inicialização automática ao carregar o DOM
document.addEventListener("DOMContentLoaded", () => {
  uiController.init();
});
