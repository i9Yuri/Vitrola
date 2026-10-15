"""
Maré - Asynchronous yt-dlp Background Updater
Provides non-blocking version checks, concurrency safety with downloads,
and manual update triggers.
"""

import os
import sys
import time
import json
import shutil
import threading
import subprocess
import urllib.request
from typing import Dict, Any, Optional

try:
    import yt_dlp
    DEFAULT_VERSION = getattr(yt_dlp.version, "__version__", "desconhecida")
except Exception:
    DEFAULT_VERSION = "desconhecida"


class YtDlpUpdater:
    def __init__(self):
        self.current_version: str = self._detect_current_version()
        self.latest_version: Optional[str] = None
        self.status: str = "idle"  # idle, checking, updating, completed, error
        self.update_available: bool = False
        self.last_checked: Optional[float] = None
        self.message: str = f"Motor yt-dlp v{self.current_version}"
        self._lock = threading.Lock()
        self._worker_thread: Optional[threading.Thread] = None

    def _detect_current_version(self) -> str:
        """Detect the version of the yt-dlp executable or Python module."""
        ytdlp_bin = shutil.which("yt-dlp")
        if ytdlp_bin:
            try:
                proc = subprocess.run(
                    [ytdlp_bin, "--ignore-config", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=4,
                    check=False,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    return proc.stdout.strip()
            except Exception:
                pass
        return DEFAULT_VERSION

    def check_for_updates(self, force: bool = False) -> Dict[str, Any]:
        """
        Check GitHub Releases for the latest yt-dlp version without blocking UI or downloads.
        """
        with self._lock:
            if self.status in ["checking", "updating"] and not force:
                return self.to_dict()
            self.status = "checking"
            self.message = "Verificando releases mais recentes..."

        def _do_check():
            try:
                url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest"
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Mare-Desktop/2.2.0",
                        "Accept": "application/vnd.github.v3+json",
                    },
                )
                with urllib.request.urlopen(req, timeout=6.0) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        tag = data.get("tag_name", "").lstrip("v").strip()
                        with self._lock:
                            self.latest_version = tag
                            self.last_checked = time.time()
                            self.current_version = self._detect_current_version()

                            if tag and tag > self.current_version and self.current_version != "desconhecida":
                                self.update_available = True
                                self.status = "idle"
                                self.message = f"Nova versão disponível: v{tag} (atual: v{self.current_version})"
                            else:
                                self.update_available = False
                                self.status = "completed"
                                self.message = f"yt-dlp está atualizado (v{self.current_version})"
                            return
            except Exception as e:
                with self._lock:
                    self.status = "error"
                    self.message = f"Não foi possível verificar atualizações: {str(e)}"
            finally:
                with self._lock:
                    if self.status not in ["completed", "error"]:
                        self.status = "idle"

        thread = threading.Thread(target=_do_check, daemon=True)
        thread.start()
        return self.to_dict()

    def perform_update(self, download_manager: Any) -> Dict[str, Any]:
        """
        Execute yt-dlp update ensuring zero conflict with active downloads.
        """
        # Guard: check concurrency with active downloads
        if download_manager.is_download_active():
            return {
                "success": False,
                "error": "Um download está em andamento. A atualização foi pausada para não interromper sua extração.",
            }

        with self._lock:
            if self.status == "updating":
                return {"success": False, "error": "Atualização já está em processamento."}
            self.status = "updating"
            self.message = "Executando atualização do motor yt-dlp..."

        def _do_update():
            ytdlp_bin = shutil.which("yt-dlp")
            updated = False
            err_msg = ""

            # 1. Try yt-dlp -U
            if ytdlp_bin:
                try:
                    proc = subprocess.run(
                        [ytdlp_bin, "-U"],
                        capture_output=True,
                        text=True,
                        timeout=60,
                        check=False,
                    )
                    if proc.returncode == 0:
                        updated = True
                    else:
                        err_msg = proc.stderr.strip() or proc.stdout.strip()
                except Exception as ex:
                    err_msg = str(ex)

            # 2. Fallback: try python -m pip install --upgrade yt-dlp
            if not updated:
                try:
                    proc = subprocess.run(
                        [sys.executable, "-m", "pip", "install", "--upgrade", "--user", "yt-dlp"],
                        capture_output=True,
                        text=True,
                        timeout=90,
                        check=False,
                    )
                    if proc.returncode == 0:
                        updated = True
                    else:
                        err_msg = err_msg or (proc.stderr.strip() or proc.stdout.strip())
                except Exception as ex:
                    err_msg = err_msg or str(ex)

            with self._lock:
                self.current_version = self._detect_current_version()
                if updated:
                    self.status = "completed"
                    self.update_available = False
                    self.message = f"yt-dlp atualizado com sucesso para v{self.current_version}!"
                else:
                    self.status = "error"
                    self.message = f"Falha na atualização: {err_msg or 'Erro desconhecido'}"

        thread = threading.Thread(target=_do_update, daemon=True)
        thread.start()
        return {"success": True, "status": self.to_dict()}

    def start_background_worker(self, delay_seconds: int = 8):
        """Start auto-check in background a few seconds after application boot."""
        def _worker():
            time.sleep(delay_seconds)
            self.check_for_updates()

        self._worker_thread = threading.Thread(target=_worker, daemon=True)
        self._worker_thread.start()

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "current_version": self.current_version,
                "latest_version": self.latest_version,
                "status": self.status,
                "update_available": self.update_available,
                "last_checked": self.last_checked,
                "message": self.message,
            }


# Global singleton instance
updater = YtDlpUpdater()
