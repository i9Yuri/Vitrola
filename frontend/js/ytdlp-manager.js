/**
 * VITROLA - GOVERNANÇA DO MOTOR YT-DLP (ytdlp-manager.js)
 * Checagem assíncrona, telemetria de integridade e atualização in-place.
 */

async function fetchWithRetry(url, options = {}, maxRetries = 3, intervalMs = 500) {
  let lastError = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
  }
  throw lastError;
}

class YtDlpManager {
  constructor() {
    this.state = {
      currentVersion: "carregando...",
      latestVersion: "",
      isUpToDate: true,
      status: "idle", // 'idle' | 'checking' | 'updating' | 'available' | 'error'
      lastChecked: null,
      logs: [],
    };
    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.state);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.state);
      } catch (e) {
        console.error("[YtDlpManager] Erro no listener:", e);
      }
    }
  }

  appendLog(msg) {
    const time = new Date().toLocaleTimeString();
    this.state.logs.push(`[${time}] ${msg}`);
    if (this.state.logs.length > 50) this.state.logs.shift();
    this.notify();
  }

  async checkStatus() {
    try {
      const res = await fetchWithRetry("/api/updater/status");
      const data = await res.json();
      if (data.success && data.updater) {
        const u = data.updater;
        this.state.currentVersion = u.current_version || "desconhecida";
        this.state.latestVersion = u.latest_version || "";
        this.state.isUpToDate = !u.update_available;
        this.state.status = u.status || (u.update_available ? "available" : "idle");
        this.state.lastChecked = new Date().toISOString();
        this.notify();
      }
    } catch (err) {
      console.warn("[YtDlpManager] Falha ao consultar status:", err);
      this.state.status = "error";
      this.notify();
    }
  }

  async triggerCheck() {
    this.state.status = "checking";
    this.appendLog("Verificando se há novas versões do yt-dlp...");
    this.notify();

    try {
      const res = await fetchWithRetry("/api/updater/check", { method: "POST" });
      const data = await res.json();
      if (data.success && data.updater) {
        const u = data.updater;
        this.state.currentVersion = u.current_version || this.state.currentVersion;
        this.state.latestVersion = u.latest_version || "";
        this.state.isUpToDate = !u.update_available;
        this.state.status = u.update_available ? "available" : "idle";

        if (u.update_available) {
          this.appendLog(`Nova versão disponível: v${u.latest_version}`);
        } else {
          this.appendLog("O executável yt-dlp já está na versão mais recente.");
        }
      } else {
        this.state.status = "error";
        this.appendLog("Não foi possível verificar versões remotas.");
      }
    } catch (err) {
      this.state.status = "error";
      this.appendLog(`Erro de conexão ao verificar: ${err.message}`);
    }
    this.notify();
  }

  async triggerUpdate() {
    if (this.state.status === "updating") return;

    this.state.status = "updating";
    this.appendLog("Iniciando processo de auto-atualização (yt-dlp -U)...");
    this.notify();

    try {
      const res = await fetch("/api/updater/update", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        this.state.status = "idle";
        this.state.isUpToDate = true;
        if (data.updater && data.updater.current_version) {
          this.state.currentVersion = data.updater.current_version;
        }
        this.appendLog(data.message || "yt-dlp atualizado com sucesso!");
        if (data.output) {
          this.appendLog(`Saída: ${data.output}`);
        }
      } else {
        this.state.status = "error";
        this.appendLog(`Falha na atualização: ${data.error || "Erro desconhecido"}`);
        if (data.output) {
          this.appendLog(`Detalhes: ${data.output}`);
        }
      }
    } catch (err) {
      this.state.status = "error";
      this.appendLog(`Erro de rede ao atualizar: ${err.message}`);
    }
    this.notify();
  }
}

export const ytdlpManager = new YtDlpManager();
