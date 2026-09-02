import os
import sys
import json
import time
import mimetypes
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Ensure root directory is on Python path
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.system import (
    load_config,
    save_config,
    get_download_directory,
    open_in_file_manager,
)
from backend.core.ytdlp_wrapper import inspect_url
from backend.downloader import manager

FRONTEND_DIR = PROJECT_ROOT / "frontend"


class MediaForgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Keep server log clean; don't spam per SSE event
        if "api/progress" not in self.path:
            super().log_message(format, *args)

    def _send_json(self, data: dict, status_code: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, message: str, status_code: int = 400):
        self._send_json({"success": False, "error": message}, status_code)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. API: Server-Sent Events (SSE) progress stream
        if path.startswith("/api/progress/"):
            task_id = path.split("/")[-1]
            self._handle_sse_progress(task_id)
            return

        # 2. API: Download History
        if path == "/api/history":
            history = manager.get_history()
            self._send_json({"success": True, "history": history})
            return

        # 3. API: System Configuration & Paths
        if path == "/api/config":
            cfg = load_config()
            cfg["effective_download_dir"] = str(get_download_directory())
            self._send_json({"success": True, "config": cfg})
            return

        # 4. Static frontend files
        if path == "/" or path == "/index.html":
            self._serve_file(FRONTEND_DIR / "index.html", "text/html; charset=utf-8")
            return
        elif path == "/styles.css":
            self._serve_file(FRONTEND_DIR / "styles.css", "text/css; charset=utf-8")
            return
        elif path == "/app.js":
            self._serve_file(FRONTEND_DIR / "app.js", "application/javascript; charset=utf-8")
            return

        # Fallback for any relative asset in frontend/
        safe_rel = path.lstrip("/")
        potential_file = (FRONTEND_DIR / safe_rel).resolve()
        if FRONTEND_DIR in potential_file.parents and potential_file.is_file():
            mime, _ = mimetypes.guess_type(str(potential_file))
            self._serve_file(potential_file, mime or "application/octet-stream")
            return

        self._send_error_json("Recurso não encontrado", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Read JSON body
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len) if content_len > 0 else b"{}"

        try:
            body = json.loads(post_data.decode("utf-8")) if post_data else {}
        except json.JSONDecodeError:
            self._send_error_json("JSON inválido no corpo da requisição")
            return

        # 1. API: Inspect URL
        if path == "/api/inspect":
            url = body.get("url", "").strip()
            if not url:
                self._send_error_json("Campo 'url' é obrigatório")
                return
            result = inspect_url(url)
            status = 200 if result.get("success") else 400
            self._send_json(result, status)
            return

        # 2. API: Start Download
        if path == "/api/download":
            url = body.get("url", "").strip()
            if not url:
                self._send_error_json("Campo 'url' é obrigatório")
                return
            task = manager.create_task(url, body)
            self._send_json({"success": True, "task_id": task.task_id})
            return

        # 3. API: Open Folder in Linux Desktop (xdg-open)
        if path == "/api/open-folder":
            target_path = body.get("path")
            res = open_in_file_manager(target_path)
            self._send_json(res, 200 if res.get("success") else 500)
            return

        # 4. API: Update Configuration
        if path == "/api/config":
            if save_config(body):
                self._send_json({"success": True, "config": load_config()})
            else:
                self._send_error_json("Erro ao salvar configuração no disco")
            return

        self._send_error_json("Endpoint não encontrado", 404)

    def _serve_file(self, file_path: Path, content_type: str):
        if not file_path.exists() or not file_path.is_file():
            self._send_error_json("Arquivo não encontrado", 404)
            return

        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(content)

    def _handle_sse_progress(self, task_id: str):
        task = manager.get_task(task_id)
        if not task:
            self._send_error_json("Tarefa de download não encontrada", 404)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        sub_queue = task.add_subscriber()
        try:
            while True:
                try:
                    # Wait for next event up to 15 seconds to send keep-alive comment
                    event_data = sub_queue.get(timeout=15.0)
                    payload = json.dumps(event_data, ensure_ascii=False)
                    msg = f"data: {payload}\n\n"
                    self.wfile.write(msg.encode("utf-8"))
                    self.wfile.flush()

                    if event_data.get("status") in ["completed", "failed", "cancelled"]:
                        break
                except Exception as ex:
                    # Timeout -> send keepalive ping comment
                    if "timed out" in str(ex).lower():
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
                    else:
                        break
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            task.remove_subscriber(sub_queue)


def run_server():
    cfg = load_config()
    host = cfg.get("server", {}).get("host", "127.0.0.1")
    port = cfg.get("server", {}).get("port", 8765)

    download_dir = get_download_directory()
    print("=" * 65)
    print("   🚀 MediaForge - High-Performance Audio/Video Downloader")
    print("=" * 65)
    print(f" • Host:             http://{host}:{port}")
    print(f" • Pasta de destino: {download_dir}")
    print(f" • Motor:            yt-dlp + ffmpeg (Nativo Nobara Linux)")
    print("=" * 65)
    print("Pressione Ctrl+C para encerrar o servidor.")

    server = ThreadingHTTPServer((host, port), MediaForgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[MediaForge] Encerrando servidor com segurança...")
        server.server_close()


if __name__ == "__main__":
    run_server()
