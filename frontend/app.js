/**
 * MEDIAFORGE - Client-Side Controller
 * Industrial High-Performance Media Downloader
 */

// Application State
const state = {
  currentUrl: "",
  inspectionData: null,
  activeMode: "audio", // "audio" | "video"
  activeTaskId: null,
  eventSource: null,
  downloadDir: "~/Downloads/MediaForge",
};

// DOM Elements
const elements = {
  inspectForm: document.getElementById("inspect-form"),
  urlInput: document.getElementById("url-input"),
  btnPaste: document.getElementById("btn-paste"),
  btnInspect: document.getElementById("btn-inspect"),
  inspectSpinner: document.getElementById("inspect-spinner"),
  inspectBtnText: document.getElementById("inspect-btn-text"),
  errorBanner: document.getElementById("error-banner"),
  errorMessage: document.getElementById("error-message"),

  // Media Inspection Panel
  mediaPanel: document.getElementById("media-panel"),
  mediaThumbnail: document.getElementById("media-thumbnail"),
  mediaDuration: document.getElementById("media-duration"),
  mediaTitle: document.getElementById("media-title"),
  mediaUploader: document.getElementById("media-uploader"),
  mediaViews: document.getElementById("media-views"),
  mediaTags: document.getElementById("media-tags"),

  // Mode Toggles & Options
  modeAudioBtn: document.getElementById("mode-audio-btn"),
  modeVideoBtn: document.getElementById("mode-video-btn"),
  audioOptions: document.getElementById("audio-options"),
  videoOptions: document.getElementById("video-options"),
  audioStreamSelect: document.getElementById("audio-stream-select"),
  videoResSelect: document.getElementById("video-res-select"),
  optMetadata: document.getElementById("opt-metadata"),
  optSubtitles: document.getElementById("opt-subtitles"),
  subLangWrapper: document.getElementById("sub-lang-wrapper"),
  subLangSelect: document.getElementById("sub-lang-select"),
  btnStartDownload: document.getElementById("btn-start-download"),
  downloadBtnText: document.getElementById("download-btn-text"),

  // Operational Progress Monitor
  progressCard: document.getElementById("progress-card"),
  progBadge: document.getElementById("prog-badge"),
  progFilename: document.getElementById("prog-filename"),
  progPctNumber: document.getElementById("prog-pct-number"),
  progressBarFill: document.getElementById("progress-bar-fill"),
  progSpeed: document.getElementById("prog-speed"),
  progEta: document.getElementById("prog-eta"),
  progSize: document.getElementById("prog-size"),
  progFolderHint: document.getElementById("prog-folder-hint"),
  progLogLine: document.getElementById("prog-log-line"),

  // History & Actions
  btnOpenFolder: document.getElementById("btn-open-folder"),
  btnRefreshHistory: document.getElementById("btn-refresh-history"),
  historyContainer: document.getElementById("history-container"),
  historyEmpty: document.getElementById("history-empty"),
};

// Initial Setup
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadConfig();
  loadHistory();
});

function setupEventListeners() {
  // Inspect Form
  elements.inspectForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleInspect();
  });

  // Paste clipboard shortcut
  elements.btnPaste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        elements.urlInput.value = text.trim();
        elements.urlInput.focus();
      }
    } catch (err) {
      console.warn("Clipboard access denied or unavailable", err);
    }
  });

  // Mode Toggles
  elements.modeAudioBtn.addEventListener("click", () => setMode("audio"));
  elements.modeVideoBtn.addEventListener("click", () => setMode("video"));

  // Subtitles Checkbox Toggle
  elements.optSubtitles.addEventListener("change", (e) => {
    if (e.target.checked) {
      elements.subLangWrapper.classList.remove("hidden");
    } else {
      elements.subLangWrapper.classList.add("hidden");
    }
  });

  // Download Trigger
  elements.btnStartDownload.addEventListener("click", handleStartDownload);

  // Open destination folder
  elements.btnOpenFolder.addEventListener("click", () => openFolder());
  elements.progFolderHint.addEventListener("click", () => openFolder());

  // History Refresh
  elements.btnRefreshHistory.addEventListener("click", loadHistory);
}

// --------------------------------------------------------------------------
// API Calls & State Handling
// --------------------------------------------------------------------------

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    if (data.success && data.config) {
      state.downloadDir = data.config.effective_download_dir || data.config.storage.download_dir;
      elements.progFolderHint.textContent = state.downloadDir;
    }
  } catch (e) {
    console.error("Failed to load config", e);
  }
}

function setMode(mode) {
  state.activeMode = mode;
  if (mode === "audio") {
    elements.modeAudioBtn.classList.add("active");
    elements.modeVideoBtn.classList.remove("active");
    elements.audioOptions.classList.remove("hidden");
    elements.videoOptions.classList.add("hidden");
    elements.downloadBtnText.textContent = "Iniciar Download de Áudio Puro (Sem Recodificação)";
  } else {
    elements.modeVideoBtn.classList.add("active");
    elements.modeAudioBtn.classList.remove("active");
    elements.videoOptions.classList.remove("hidden");
    elements.audioOptions.classList.add("hidden");
    elements.downloadBtnText.textContent = "Iniciar Download de Vídeo MP4 Multiplexado";
  }
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorBanner.classList.remove("hidden");
}

function hideError() {
  elements.errorBanner.classList.add("hidden");
  elements.errorMessage.textContent = "";
}

async function handleInspect() {
  const url = elements.urlInput.value.trim();
  if (!url) return;

  hideError();
  setInspectLoading(true);
  elements.mediaPanel.classList.add("hidden");

  try {
    const response = await fetch("/api/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonPayload({ url }),
    });

    const data = await response.json();
    if (!data.success) {
      showError(data.error || "Erro ao inspecionar a URL fornecida.");
      return;
    }

    state.currentUrl = url;
    state.inspectionData = data;
    renderInspection(data);
  } catch (err) {
    showError("Erro de comunicação com o servidor local: " + err.message);
  } finally {
    setInspectLoading(false);
  }
}

function setInspectLoading(loading) {
  if (loading) {
    elements.btnInspect.disabled = true;
    elements.inspectSpinner.classList.remove("hidden");
    elements.inspectBtnText.textContent = "Inspecionando Streams...";
  } else {
    elements.btnInspect.disabled = false;
    elements.inspectSpinner.classList.add("hidden");
    elements.inspectBtnText.textContent = "Analisar Mídia";
  }
}

function renderInspection(data) {
  const meta = data.metadata;

  // Header data
  elements.mediaThumbnail.src = meta.thumbnail || "";
  elements.mediaDuration.textContent = meta.duration_str || "--:--";
  elements.mediaTitle.textContent = meta.title || "Mídia sem título";
  elements.mediaUploader.textContent = meta.uploader || "Desconhecido";

  if (meta.view_count) {
    elements.mediaViews.textContent = Number(meta.view_count).toLocaleString("pt-BR") + " visualizações";
    document.getElementById("media-views-wrapper").classList.remove("hidden");
  } else {
    document.getElementById("media-views-wrapper").classList.add("hidden");
  }

  // Tags
  elements.mediaTags.innerHTML = "";
  if (meta.tags && meta.tags.length > 0) {
    meta.tags.slice(0, 5).forEach((tag) => {
      const span = document.createElement("span");
      span.className = "tag-badge";
      span.textContent = "#" + tag;
      elements.mediaTags.appendChild(span);
    });
  }

  // Populate Audio Streams
  elements.audioStreamSelect.innerHTML = "";
  if (data.audio_streams && data.audio_streams.length > 0) {
    data.audio_streams.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.format_id;
      opt.textContent = `${s.label} [Codec: ${s.codec_name}]`;
      if (s.is_preferred) {
        opt.selected = true;
      }
      elements.audioStreamSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Melhor Áudio Nativo Automático (ba[ext=opus]/ba[ext=m4a]/ba)";
    elements.audioStreamSelect.appendChild(opt);
  }

  // Populate Video Presets
  elements.videoResSelect.innerHTML = "";
  if (data.video_presets && data.video_presets.length > 0) {
    data.video_presets.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.height;
      opt.textContent = p.label;
      if (p.is_default) {
        opt.selected = true;
      }
      elements.videoResSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement("option");
    opt.value = "1080";
    opt.textContent = "Full HD (1080p) Padrão";
    elements.videoResSelect.appendChild(opt);
  }

  // Populate Subtitles
  elements.subLangSelect.innerHTML = "";
  if (data.subtitles && data.subtitles.length > 0) {
    elements.subtitlesSection = true;
    data.subtitles.forEach((sub) => {
      const opt = document.createElement("option");
      opt.value = sub.code;
      opt.textContent = `${sub.name} [${sub.code}]`;
      if (sub.code.startsWith("pt")) {
        opt.selected = true;
      }
      elements.subLangSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "Todas as legendas disponíveis";
    elements.subLangSelect.appendChild(opt);
  }

  // Default mode
  setMode(state.activeMode);
  elements.mediaPanel.classList.remove("hidden");
  elements.mediaPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function handleStartDownload() {
  if (!state.currentUrl) return;

  const mode = state.activeMode;
  const payload = {
    url: state.currentUrl,
    mode: mode,
    title: state.inspectionData?.metadata?.title || "Download",
    embed_metadata: elements.optMetadata.checked,
    embed_thumbnail: elements.optMetadata.checked,
    embed_subtitles: elements.optSubtitles.checked,
    subtitle_lang: elements.optSubtitles.checked ? elements.subLangSelect.value : null,
  };

  if (mode === "audio") {
    payload.format_id = elements.audioStreamSelect.value || null;
  } else {
    payload.target_res = parseInt(elements.videoResSelect.value, 10) || 1080;
  }

  elements.btnStartDownload.disabled = true;
  elements.downloadBtnText.textContent = "Iniciando Processo...";

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonPayload(payload),
    });

    const data = await res.json();
    if (!data.success) {
      showError("Falha ao agendar download: " + data.error);
      elements.btnStartDownload.disabled = false;
      return;
    }

    startProgressMonitoring(data.task_id);
  } catch (err) {
    showError("Erro na requisição de download: " + err.message);
    elements.btnStartDownload.disabled = false;
  }
}

// --------------------------------------------------------------------------
// Real-Time SSE Progress Monitoring
// --------------------------------------------------------------------------

function startProgressMonitoring(taskId) {
  state.activeTaskId = taskId;

  if (state.eventSource) {
    state.eventSource.close();
  }

  // Reset Progress Card UI
  elements.progressCard.classList.remove("hidden");
  elements.progressCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  elements.progBadge.className = "operational-tag";
  elements.progBadge.textContent = "INICIALIZANDO";
  elements.progFilename.textContent = state.inspectionData?.metadata?.title || "Preparando...";
  elements.progressBarFill.style.width = "0%";
  elements.progPctNumber.textContent = "0.0";
  elements.progSpeed.textContent = "Conectando...";
  elements.progEta.textContent = "--:--";
  elements.progSize.textContent = "--";
  elements.progLogLine.textContent = "Estabelecendo stream com o processo yt-dlp...";

  const sse = new EventSource(`/api/progress/${taskId}`);
  state.eventSource = sse;

  sse.onmessage = (event) => {
    try {
      const task = JSON.parse(event.data);
      updateProgressUI(task);

      if (task.status === "completed") {
        sse.close();
        onDownloadCompleted(task);
      } else if (task.status === "failed") {
        sse.close();
        onDownloadFailed(task);
      }
    } catch (err) {
      console.warn("Error parsing SSE data", err);
    }
  };

  sse.onerror = (e) => {
    console.warn("SSE connection error or closed", e);
  };
}

function updateProgressUI(task) {
  const pct = Math.min(Math.max(task.progress_percent || 0, 0), 100);
  elements.progressBarFill.style.width = `${pct}%`;
  elements.progPctNumber.textContent = pct.toFixed(1);

  if (task.filename) {
    elements.progFilename.textContent = task.filename;
  }

  elements.progSpeed.textContent = task.speed || "-- KiB/s";
  elements.progEta.textContent = task.eta || "--:--";
  elements.progSize.textContent = task.total_size || "--";

  if (task.status === "downloading") {
    elements.progBadge.className = "operational-tag";
    elements.progBadge.textContent = "BAIXANDO";
    elements.progLogLine.textContent = `Recebendo stream: ${task.speed} • ETA: ${task.eta}`;
  } else if (task.status === "processing") {
    elements.progBadge.className = "operational-tag processing";
    elements.progBadge.textContent = "PROCESSANDO";
    elements.progLogLine.textContent = task.speed || "Multiplexando faixas de áudio e vídeo...";
  }
}

function onDownloadCompleted(task) {
  elements.progBadge.className = "operational-tag";
  elements.progBadge.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
  elements.progBadge.style.color = "var(--accent-emerald)";
  elements.progBadge.textContent = "CONCLUÍDO";

  elements.progressBarFill.style.width = "100%";
  elements.progPctNumber.textContent = "100.0";
  elements.progSpeed.textContent = "Finalizado";
  elements.progEta.textContent = "00:00";
  elements.progLogLine.textContent = `Arquivo salvo com sucesso em: ${task.filepath || state.downloadDir}`;

  elements.btnStartDownload.disabled = false;
  setMode(state.activeMode);

  loadHistory();
}

function onDownloadFailed(task) {
  elements.progBadge.className = "operational-tag failed";
  elements.progBadge.textContent = "FALHOU";
  elements.progSpeed.textContent = "Erro";
  elements.progLogLine.textContent = task.error || "Ocorreu uma falha durante o processo.";

  elements.btnStartDownload.disabled = false;
  setMode(state.activeMode);
  showError(task.error || "Falha ao processar download.");
}

// --------------------------------------------------------------------------
// History & Desktop Integration (xdg-open)
// --------------------------------------------------------------------------

async function openFolder(path = null) {
  try {
    const res = await fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonPayload({ path }),
    });
    const data = await res.json();
    if (!data.success) {
      alert("Não foi possível abrir o gerenciador: " + (data.error || "Erro desconhecido"));
    }
  } catch (err) {
    alert("Erro ao invocar xdg-open: " + err.message);
  }
}

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    if (data.success && Array.isArray(data.history)) {
      renderHistory(data.history);
    }
  } catch (e) {
    console.error("Failed to load history", e);
  }
}

function renderHistory(items) {
  if (!items || items.length === 0) {
    elements.historyContainer.innerHTML = `
      <div class="empty-state" id="history-empty">
        <span>Nenhum download registrado nesta sessão. Insira uma URL acima para começar.</span>
      </div>
    `;
    return;
  }

  elements.historyContainer.innerHTML = "";
  items.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";

    const isAudio = item.mode === "audio";
    const typeLabel = isAudio ? "ÁUDIO PURO" : "VÍDEO MP4";

    el.innerHTML = `
      <div class="history-item-left">
        <span class="history-type-badge">${typeLabel}</span>
        <span class="history-name" title="${escapeHtml(item.filename || item.title)}">
          ${escapeHtml(item.filename || item.title)}
        </span>
      </div>
      <button class="btn btn-secondary btn-compact btn-open-item" title="Abrir pasta no gerenciador">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>Abrir</span>
      </button>
    `;

    const btn = el.querySelector(".btn-open-item");
    btn.addEventListener("click", () => {
      openFolder(item.filepath || null);
    });

    elements.historyContainer.appendChild(el);
  });
}

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------

function jsonPayload(obj) {
  return JSON.stringify(obj);
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
