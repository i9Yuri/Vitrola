"""
Maré - Native Frameless Desktop Window Runner
Supports PySide6 (QtWebEngine) and pywebview seamlessly.
Configured for frameless window mode with integrated controls.
"""

import sys
import time
from typing import Optional, Dict, Any

WINDOW_TITLE = "Maré"
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 760
MIN_WIDTH = 840
MIN_HEIGHT = 580

_active_window = None


def dispatch_window_action(action: str) -> Dict[str, Any]:
    """Execute window actions (minimize, maximize, close) from API or IPC."""
    global _active_window
    if not _active_window:
        return {"success": False, "error": "Nenhuma janela ativa"}

    try:
        # PySide6 Qt Window
        if hasattr(_active_window, "isMaximized"):
            from PySide6.QtCore import QMetaObject, Qt

            if action == "minimize":
                _active_window.showMinimized()
                return {"success": True, "action": "minimize"}
            elif action == "maximize":
                if _active_window.isMaximized():
                    _active_window.showNormal()
                    return {"success": True, "isMaximized": False}
                else:
                    _active_window.showMaximized()
                    return {"success": True, "isMaximized": True}
            elif action == "close":
                _active_window.close()
                return {"success": True, "action": "close"}

        # pywebview Window
        elif hasattr(_active_window, "destroy"):
            if action == "minimize":
                _active_window.minimize()
                return {"success": True, "action": "minimize"}
            elif action == "maximize":
                _active_window.toggle_fullscreen()
                return {"success": True, "action": "maximize"}
            elif action == "close":
                _active_window.destroy()
                return {"success": True, "action": "close"}
    except Exception as e:
        print(f"[Desktop] Erro ao executar ação de janela '{action}': {e}")
        return {"success": False, "error": str(e)}

    return {"success": False, "error": f"Ação desconhecida '{action}'"}


def launch_desktop_window(server_url: str):
    """
    Launch the native desktop window pointing to the local Maré HTTP server.
    Uses frameless mode without OS titlebars.
    """
    global _active_window

    # 1. Try pywebview if installed
    try:
        import webview
        print(f"[Desktop] Inicializando janela frameless do Maré via pywebview ({WINDOW_WIDTH}x{WINDOW_HEIGHT})...")
        _active_window = webview.create_window(
            title=WINDOW_TITLE,
            url=server_url,
            width=WINDOW_WIDTH,
            height=WINDOW_HEIGHT,
            min_size=(MIN_WIDTH, MIN_HEIGHT),
            resizable=True,
            frameless=True,
            easy_drag=True,
            background_color="#181A21",
        )
        webview.start()
        return
    except ImportError:
        pass
    except Exception as e:
        print(f"[Desktop] Aviso ao tentar pywebview: {e}")

    # 2. Try PySide6 QtWebEngine (native to Nobara Linux / Fedora)
    try:
        from PySide6.QtCore import QUrl, QSize, Qt, QPoint
        from PySide6.QtGui import QColor, QPalette
        from PySide6.QtWidgets import QApplication, QMainWindow
        from PySide6.QtWebEngineWidgets import QWebEngineView

        print(f"[Desktop] Inicializando janela nativa frameless do Maré via PySide6 ({WINDOW_WIDTH}x{WINDOW_HEIGHT})...")

        app = QApplication.instance() or QApplication(sys.argv)
        app.setApplicationName(WINDOW_TITLE)
        if hasattr(app, "setDesktopFileName"):
            app.setDesktopFileName("mare.desktop")

        palette = QPalette()
        palette.setColor(QPalette.Window, QColor("#181A21"))
        palette.setColor(QPalette.WindowText, QColor("#EFF0F5"))
        palette.setColor(QPalette.Base, QColor("#121319"))
        palette.setColor(QPalette.Text, QColor("#EFF0F5"))
        app.setPalette(palette)

        class MareFramelessWindow(QMainWindow):
            def __init__(self, url: str):
                super().__init__()
                self.setWindowTitle(WINDOW_TITLE)
                self.resize(WINDOW_WIDTH, WINDOW_HEIGHT)
                self.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)

                # Frameless window configuration: eliminates nested window look
                self.setWindowFlags(Qt.FramelessWindowHint | Qt.Window)
                self.setAttribute(Qt.WA_TranslucentBackground, False)

                # WebEngine View with dark background matching Slate theme
                self.browser = QWebEngineView(self)
                self.browser.setStyleSheet("background-color: #181A21;")
                self.browser.setUrl(QUrl(url))
                self.setCentralWidget(self.browser)

                self._drag_pos = None

            def mousePressEvent(self, event):
                if event.button() == Qt.LeftButton and event.position().y() <= 48:
                    win_handle = self.windowHandle()
                    if win_handle and hasattr(win_handle, "startSystemMove"):
                        win_handle.startSystemMove()
                    else:
                        self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
                    event.accept()
                else:
                    super().mousePressEvent(event)

            def mouseMoveEvent(self, event):
                if self._drag_pos is not None and event.buttons() == Qt.LeftButton:
                    self.move(event.globalPosition().toPoint() - self._drag_pos)
                    event.accept()
                else:
                    super().mouseMoveEvent(event)

            def mouseReleaseEvent(self, event):
                self._drag_pos = None
                super().mouseReleaseEvent(event)

        _active_window = MareFramelessWindow(server_url)
        _active_window.show()

        sys.exit(app.exec())
    except ImportError as e:
        print(f"[Desktop] Erro: Nem pywebview nem PySide6 estão disponíveis para GUI: {e}")
        print(f"[Desktop] Acesse manualmente via: {server_url}")
    except Exception as e:
        print(f"[Desktop] Falha na execução da janela nativa: {e}")
        print(f"[Desktop] Acesse manualmente via: {server_url}")
