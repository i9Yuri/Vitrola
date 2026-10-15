import os
import sys
import json
import time
import mimetypes
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

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
    select_directory_dialog,
    get_resource_path,
)
from backend.core.ytdlp_wrapper import inspect_url
from backend.core.updater import updater
from backend.downloader import manager

FRONTEND_DIR = get_resource_path("frontend")


class VitrolaHandler(BaseHTTPRequestHandler):
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

        # 4. API: yt-dlp Updater Status
        if path == "/api/updater/status":
            self._send_json({"success": True, "updater": updater.to_dict()})
            return

        # 4.1 API: Clipboard Fallback
        if path == "/api/clipboard":
            text = ""
            try:
                if os.environ.get("WAYLAND_DISPLAY"):
                    p = subprocess.run(["wl-paste", "--no-newline"], capture_output=True, text=True, timeout=1)
                    if p.returncode == 0:
                        text = p.stdout
            except Exception:
                pass
            if not text:
                try:
                    p = subprocess.run(["xclip", "-selection", "clipboard", "-o"], capture_output=True, text=True, timeout=1)
                    if p.returncode == 0:
                        text = p.stdout
                except Exception:
                    pass
            self._send_json({"success": True, "text": text}, 200)
            return

        # 4.2 API: Download Error Details
        if path == "/api/download/error-details":
            query = parse_qs(parsed.query)
            task_id = query.get("taskId", [""])[0] or query.get("task_id", [""])[0]
            task = manager.get_task(task_id) if task_id else None
            if task and task.error_details:
                self._send_json({"success": True, "error_details": task.error_details}, 200)
            else:
                self._send_json(
                    {
                        "success": True,
                        "error_details": {
                            "taskId": task_id,
                            "summary": "Ocorreu uma falha no processamento deste download.",
                            "rawErrorLog": "Nenhum log adicional arquivado para esta tarefa.",
                            "suggestedAction": "Clique em 'Tentar novamente' para reiniciar.",
                            "isThumbnailError": False,
                        },
                    },
                    200,
                )
            return

        # 5. Static frontend files
        if path == "/" or path == "/index.html":
            self._serve_file(FRONTEND_DIR / "index.html", "text/html; charset=utf-8")
            return
        elif path == "/styles.css":
            self._serve_file(FRONTEND_DIR / "styles.css", "text/css; charset=utf-8")
            return
        elif path == "/app.js":
            self._serve_file(FRONTEND_DIR / "app.js", "application/javascript; charset=utf-8")
            return
        elif path == "/api/storage/telemetry":
            from backend.core.system import get_directory_telemetry
            self._send_json(get_directory_telemetry(), 200)
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

        # 2.1 API: Retry Failed Download
        if path == "/api/download/retry":
            task_id = body.get("taskId") or body.get("task_id")
            suppress_thumb = bool(body.get("suppressThumbnail") or body.get("suppress_thumbnail"))
            if not task_id:
                self._send_error_json("Campo 'taskId' é obrigatório")
                return
            retried = manager.retry_task(task_id, suppress_thumb)
            if retried:
                self._send_json({"success": True, "task_id": task_id})
            else:
                self._send_error_json("Tarefa não encontrada para reexecução", 404)
            return

        # 3. API: Open Folder in Linux Desktop (xdg-open)
        if path == "/api/open-folder":
            target_path = body.get("path")
            res = open_in_file_manager(target_path)
            self._send_json(res, 200 if res.get("success") else 500)
            return

        # 3.0 API: Storage Telemetry
        if path == "/api/storage/telemetry":
            from backend.core.system import get_directory_telemetry
            target_path = body.get("path")
            self._send_json(get_directory_telemetry(target_path), 200)
            return

        # 3.1 API: Select Folder Native Dialog
        if path == "/api/select-folder":
            res = select_directory_dialog()
            self._send_json(res, 200)
            return

        # 3.2 API: Check File Existence & Reveal
        if path == "/api/check-file":
            file_path = body.get("path")
            if file_path:
                p = Path(file_path).expanduser().resolve()
                if p.is_file():
                    res = open_in_file_manager(str(p))
                    self._send_json({"success": True, "exists": True, "opened": str(p)}, 200)
                    return
            self._send_json(
                {
                    "success": False,
                    "exists": False,
                    "error": "O arquivo não foi encontrado no disco. Ele pode ter sido movido ou excluído.",
                },
                200,
            )
            return

        # 3.3 API: Window Action Dispatcher
        if path == "/api/window/action":
            action = body.get("action", "")
            if action == "close":
                try:
                    manager.cancel_all_active_tasks()
                except Exception as e:
                    print(f"[Main] Aviso ao cancelar processos na finalização: {e}")
            try:
                from backend.desktop import dispatch_window_action
                res = dispatch_window_action(action)
                self._send_json(res, 200)
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, 200)
            return

        # 3.4 API: History Record Management (Delete Item or Clear All)
        if path == "/api/history/delete" or (path == "/api/history" and body.get("action") == "delete"):
            media_key = body.get("media_key") or body.get("mediaKey") or body.get("id")
            if not media_key:
                self._send_error_json("Campo 'media_key' é obrigatório para exclusão")
                return
            success = manager.delete_history_item(str(media_key))
            self._send_json({"success": success, "history": manager.get_history()})
            return

        if path == "/api/history/clear" or (path == "/api/history" and body.get("action") == "clear"):
            success = manager.clear_history()
            self._send_json({"success": success, "history": []})
            return

        # 4. API: Update Configuration
        if path == "/api/config":
            if save_config(body):
                self._send_json({"success": True, "config": load_config()})
            else:
                self._send_error_json("Erro ao salvar configuração no disco")
            return

        # 5. API: Check yt-dlp update
        if path == "/api/updater/check":
            res = updater.check_for_updates(force=True)
            self._send_json({"success": True, "updater": res})
            return

        # 6. API: Trigger yt-dlp update
        if path == "/api/updater/update":
            res = updater.perform_update(manager)
            status_code = 200 if res.get("success") else 400
            self._send_json(res, status_code)
            return

        self._send_error_json("Endpoint não encontrado", 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/history":
            success = manager.clear_history()
            self._send_json({"success": success, "history": []})
            return
        elif path.startswith("/api/history/"):
            media_key = unquote(path.split("/api/history/", 1)[1])
            success = manager.delete_history_item(media_key)
            self._send_json({"success": success, "history": manager.get_history()})
            return

        self._send_error_json("Endpoint DELETE não encontrado", 404)

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


def run_server(headless: bool = False):
    import threading
    from backend.desktop import launch_desktop_window

    cfg = load_config()
    host = cfg.get("server", {}).get("host", "127.0.0.1")
    port = cfg.get("server", {}).get("port", 8765)
    server_url = f"http://{host}:{port}"

    download_dir = get_download_directory()
    print("=" * 65)
    print("   🎶 Vitrola - Baixador de Áudio e Vídeo de Alta Performance")
    print("=" * 65)
    print(f" • Host Local:       {server_url}")
    print(f" • Pasta de destino: {download_dir}")
    print(f" • Motor:            yt-dlp + ffmpeg (Nativo Nobara Linux)")
    print(f" • Modo Desktop:     {'Headless / Servidor' if headless else 'Janela Nativa'}")
    print("=" * 65)

    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer((host, port), VitrolaHandler)

    # Iniciar verificação assíncrona não bloqueante do yt-dlp
    updater.start_background_worker(delay_seconds=6)

    if headless or (not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY")):
        print("Executando em modo servidor (headless). Pressione Ctrl+C para encerrar.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n[Vitrola] Encerrando servidor com segurança...")
            server.server_close()
    else:
        # Run HTTP server in background thread and open native desktop window
        srv_thread = threading.Thread(target=server.serve_forever, daemon=True)
        srv_thread.start()
        time.sleep(0.3)

        try:
            launch_desktop_window(server_url)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    is_headless = "--headless" in sys.argv or "--server-only" in sys.argv
    run_server(headless=is_headless)

