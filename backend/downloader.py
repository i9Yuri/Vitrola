import os
import re
import time
import uuid
import json
import queue
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from .core.ytdlp_wrapper import build_download_command, clean_media_title
from .core.system import get_download_directory, open_in_file_manager

def get_history_file() -> Path:
    user_hist = Path(os.path.expanduser("~/.config/mare/history.json"))
    if user_hist.exists():
        return user_hist
    legacy_user_hist = Path(os.path.expanduser("~/.config/mediaforge/history.json"))
    if legacy_user_hist.exists():
        try:
            user_hist.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy_user_hist, user_hist)
            print(f"[Downloader] Migrado histórico legado de {legacy_user_hist} para {user_hist}")
            return user_hist
        except Exception as e:
            print(f"[Downloader] Aviso ao migrar histórico legado: {e}")
            return legacy_user_hist
    local_hist = Path.cwd() / "config" / "history.json"
    if local_hist.parent.exists():
        return local_hist
    return user_hist

HISTORY_FILE = get_history_file()


class DownloadTask:
    def __init__(self, task_id: str, url: str, options: Dict[str, Any]):
        self.task_id = task_id
        self.url = url
        self.options = options
        self.mode = options.get("mode", "audio")
        self.title = clean_media_title(options.get("title", "Carregando mídia..."))
        self.status = "queued"  # queued, downloading, processing, completed, failed
        self.progress_percent = 0.0
        self.speed = "0 KiB/s"
        self.eta = "--:--"
        self.total_size = "N/A"
        self.filename = ""
        self.filepath = ""
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.updated_at = time.time()
        self.logs: List[str] = []
        self.subscribers: List[queue.Queue] = []
        self._lock = threading.Lock()
        self.process: Optional[subprocess.Popen] = None

    def add_subscriber(self) -> queue.Queue:
        q = queue.Queue(maxsize=100)
        with self._lock:
            self.subscribers.append(q)
            # Push initial state
            q.put(self.to_dict())
        return q

    def remove_subscriber(self, q: queue.Queue):
        with self._lock:
            if q in self.subscribers:
                self.subscribers.remove(q)

    def broadcast(self):
        self.updated_at = time.time()
        state = self.to_dict()
        with self._lock:
            for q in list(self.subscribers):
                try:
                    q.put_nowait(state)
                except queue.Full:
                    pass

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "url": self.url,
            "mode": self.mode,
            "title": self.title,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "speed": self.speed,
            "eta": self.eta,
            "total_size": self.total_size,
            "filename": self.filename,
            "filepath": self.filepath,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class DownloadManager:
    def __init__(self):
        self.tasks: Dict[str, DownloadTask] = {}
        self.history: List[Dict[str, Any]] = self._load_history()
        self._lock = threading.Lock()

    def _load_history(self) -> List[Dict[str, Any]]:
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    raw_list = json.load(f)
                    cleaned = []
                    for item in raw_list:
                        if not isinstance(item, dict):
                            continue
                        # Garantir completed_at em formato ISO válido
                        completed_at = item.get("completed_at")
                        if not completed_at:
                            ts = item.get("timestamp")
                            if isinstance(ts, (int, float)):
                                try:
                                    completed_at = datetime.fromtimestamp(ts, timezone.utc).isoformat()
                                except Exception:
                                    completed_at = datetime.now(timezone.utc).isoformat()
                            else:
                                completed_at = datetime.now(timezone.utc).isoformat()
                        item["completed_at"] = completed_at
                        item["download_count"] = max(1, int(item.get("download_count", 1)))
                        item["media_key"] = item.get("media_key") or f"{item.get('title', '')}_{item.get('mode', '')}"
                        cleaned.append(item)
                    return cleaned
            except Exception as e:
                print(f"[History] Failed to load history: {e}")
        return []

    def _save_history(self):
        try:
            HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(self.history[:50], f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[History] Failed to save history: {e}")

    def create_task(self, url: str, options: Dict[str, Any]) -> DownloadTask:
        task_id = str(uuid.uuid4())[:8]
        task = DownloadTask(task_id, url, options)
        with self._lock:
            # Poda preventiva de tarefas finalizadas para manter uso de memória mínimo
            if len(self.tasks) > 50:
                finished_keys = [k for k, t in self.tasks.items() if t.status in ("completed", "failed", "cancelled")]
                for k in finished_keys[:-15]:
                    del self.tasks[k]
            self.tasks[task_id] = task

        thread = threading.Thread(target=self._run_task, args=(task,), daemon=True)
        thread.start()
        return task

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        with self._lock:
            return self.tasks.get(task_id)

    def get_history(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.history)

    def is_download_active(self) -> bool:
        """Returns True if any task is currently downloading or processing."""
        with self._lock:
            for t in self.tasks.values():
                if t.status in ["downloading", "processing"]:
                    return True
            return False

    def _run_task(self, task: DownloadTask):
        download_dir = get_download_directory()
        cmd = build_download_command(
            url=task.url,
            mode=task.mode,
            output_dir=download_dir,
            format_id=task.options.get("format_id"),
            target_res=int(task.options.get("target_res", 1080)),
            embed_metadata=bool(task.options.get("embed_metadata", True)),
            embed_thumbnail=bool(task.options.get("embed_thumbnail", True)),
            embed_subtitles=bool(task.options.get("embed_subtitles", False)),
            subtitle_lang=task.options.get("subtitle_lang"),
        )

        task.status = "downloading"
        task.broadcast()

        try:
            task.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

            # Regular expressions for line parsing
            progress_marker_regex = re.compile(
                r"^PROGRESS:(?P<pct>[^|]+)\|(?P<speed>[^|]+)\|(?P<eta>[^|]+)\|(?P<size>[^|]+)\|(?P<fname>.*)$"
            )
            standard_dl_regex = re.compile(
                r"\[download\]\s+(?P<pct>[0-9\.]+)%\s+of\s+(?P<size>[~0-9\.]+[a-zA-Z]+)\s+at\s+(?P<speed>[~0-9\.]+[a-zA-Z]+/s)\s+ETA\s+(?P<eta>[0-9:]+)"
            )
            merger_regex = re.compile(r"\[Merger\] Merging formats into \"(?P<path>.*)\"")
            destination_regex = re.compile(r"\[download\] Destination: (?P<path>.*)")
            already_regex = re.compile(r"\[download\] (?P<path>.*) has already been downloaded")

            for raw_line in task.process.stdout:
                line = raw_line.strip()
                if not line:
                    continue

                task.logs.append(line)
                if len(task.logs) > 100:
                    task.logs.pop(0)

                # Check custom progress template
                m = progress_marker_regex.match(line)
                if m:
                    pct_str = m.group("pct").replace("%", "").strip()
                    try:
                        task.progress_percent = round(float(pct_str), 1)
                    except ValueError:
                        pass
                    task.speed = m.group("speed").strip() or task.speed
                    task.eta = m.group("eta").strip() or task.eta
                    task.total_size = m.group("size").strip() or task.total_size
                    fname = m.group("fname").strip()
                    if fname:
                        task.filename = Path(fname).name
                        task.filepath = fname
                    task.broadcast()
                    continue

                # Fallback standard yt-dlp progress
                m_std = standard_dl_regex.search(line)
                if m_std:
                    try:
                        task.progress_percent = round(float(m_std.group("pct")), 1)
                    except ValueError:
                        pass
                    task.speed = m_std.group("speed").strip()
                    task.eta = m_std.group("eta").strip()
                    task.total_size = m_std.group("size").strip()
                    task.broadcast()
                    continue

                # Processing markers
                if "[Merger]" in line or "Merging formats" in line:
                    task.status = "processing"
                    task.speed = "Mesclando streams..."
                    m_mrg = merger_regex.search(line)
                    if m_mrg:
                        task.filepath = m_mrg.group("path").strip()
                        task.filename = Path(task.filepath).name
                    task.broadcast()
                elif "[Metadata]" in line or "Adding metadata" in line:
                    task.status = "processing"
                    task.speed = "Embutindo metadados..."
                    task.broadcast()
                elif "[Thumbnails]" in line or "Embedding thumbnail" in line:
                    task.status = "processing"
                    task.speed = "Embutindo capa HD..."
                    task.broadcast()
                elif "[EmbedSubtitle]" in line or "Embedding subtitles" in line:
                    task.status = "processing"
                    task.speed = "Embutindo legendas..."
                    task.broadcast()
                elif "[download] Destination:" in line:
                    m_dest = destination_regex.search(line)
                    if m_dest:
                        task.filepath = m_dest.group("path").strip()
                        task.filename = Path(task.filepath).name
                        task.broadcast()
                elif "has already been downloaded" in line:
                    m_alr = already_regex.search(line)
                    if m_alr:
                        task.filepath = m_alr.group("path").strip()
                        task.filename = Path(task.filepath).name
                    task.progress_percent = 100.0

            task.process.wait()
            ret_code = task.process.returncode

            if ret_code == 0:
                task.status = "completed"
                task.progress_percent = 100.0
                task.speed = "Concluído"
                task.eta = "00:00"

                # Verify actual file on disk if filepath wasn't captured directly
                if not task.filepath or not Path(task.filepath).exists():
                    # Look in download_dir for recently created file
                    recent_files = sorted(
                        download_dir.glob("*.*"),
                        key=lambda p: p.stat().st_mtime,
                        reverse=True,
                    )
                    if recent_files:
                        task.filepath = str(recent_files[0])
                        task.filename = recent_files[0].name

                # Add to history with deduplication and grouping
                media_key = f"{task.url.strip()}_{task.mode}"
                now_iso = datetime.now(timezone.utc).isoformat()

                with self._lock:
                    existing = None
                    for h in self.history:
                        if h.get("media_key") == media_key or (
                            h.get("title") == task.title and h.get("mode") == task.mode
                        ):
                            existing = h
                            break

                    if existing:
                        existing["download_count"] = existing.get("download_count", 1) + 1
                        existing["completed_at"] = now_iso
                        existing["filepath"] = task.filepath
                        existing["filename"] = task.filename
                        existing["size"] = task.total_size
                        existing["total_size"] = task.total_size
                        self.history.remove(existing)
                        self.history.insert(0, existing)
                    else:
                        entry = {
                            "id": task.task_id,
                            "task_id": task.task_id,
                            "media_key": media_key,
                            "title": task.title,
                            "mode": task.mode,
                            "filename": task.filename,
                            "filepath": task.filepath,
                            "format": task.options.get("format", ""),
                            "completed_at": now_iso,
                            "timestamp": time.time(),
                            "size": task.total_size,
                            "total_size": task.total_size,
                            "download_count": 1,
                            "success": True,
                        }
                        self.history.insert(0, entry)

                    self._save_history()

            else:
                task.status = "failed"
                # Extract most useful error snippet from logs
                err_lines = [l for l in task.logs if "ERROR:" in l or "error:" in l.lower()]
                task.error = err_lines[-1] if err_lines else f"Processo yt-dlp finalizou com código de erro {ret_code}"

            task.broadcast()

        except Exception as e:
            task.status = "failed"
            task.error = f"Exceção no gerenciador de download: {str(e)}"
            task.broadcast()


# Global manager singleton
manager = DownloadManager()
