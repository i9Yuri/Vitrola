"""
MediaForge - Native Desktop Window Runner
Supports PySide6 (QtWebEngine) and pywebview seamlessly.
Runs without opening external browsers.
"""

import sys
import time
from typing import Optional

WINDOW_TITLE = "MediaForge"
WINDOW_WIDTH = 960
WINDOW_HEIGHT = 720
MIN_WIDTH = 800
MIN_HEIGHT = 600


def launch_desktop_window(server_url: str):
    """
    Launch the native desktop window pointing to the local MediaForge HTTP server.
    Tries pywebview first, then PySide6 QtWebEngine.
    """
    # 1. Try pywebview if installed
    try:
        import webview
        print(f"[Desktop] Inicializando janela nativa via pywebview ({WINDOW_WIDTH}x{WINDOW_HEIGHT})...")
        webview.create_window(
            title=WINDOW_TITLE,
            url=server_url,
            width=WINDOW_WIDTH,
            height=WINDOW_HEIGHT,
            min_size=(MIN_WIDTH, MIN_HEIGHT),
            resizable=True,
            background_color="#0b0f17",
        )
        webview.start()
        return
    except ImportError:
        pass
    except Exception as e:
        print(f"[Desktop] Aviso ao tentar pywebview: {e}")

    # 2. Try PySide6 QtWebEngine (native to Nobara Linux / Fedora)
    try:
        from PySide6.QtCore import QUrl, QSize, Qt
        from PySide6.QtGui import QColor, QPalette
        from PySide6.QtWidgets import QApplication, QMainWindow
        from PySide6.QtWebEngineWidgets import QWebEngineView

        print(f"[Desktop] Inicializando janela nativa via PySide6 QtWebEngine ({WINDOW_WIDTH}x{WINDOW_HEIGHT})...")

        # Create Qt Application if not already created
        app = QApplication.instance() or QApplication(sys.argv)
        app.setApplicationName(WINDOW_TITLE)

        # Set dark palette matching the industrial theme
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor("#0b0f17"))
        palette.setColor(QPalette.WindowText, QColor("#f1f5f9"))
        palette.setColor(QPalette.Base, QColor("#0f1726"))
        palette.setColor(QPalette.Text, QColor("#f1f5f9"))
        app.setPalette(palette)

        class MediaForgeWindow(QMainWindow):
            def __init__(self, url: str):
                super().__init__()
                self.setWindowTitle(WINDOW_TITLE)
                self.resize(WINDOW_WIDTH, WINDOW_HEIGHT)
                self.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)

                # WebEngine View
                self.browser = QWebEngineView(self)
                self.browser.setStyleSheet("background-color: #0b0f17;")
                self.browser.setUrl(QUrl(url))
                self.setCentralWidget(self.browser)

        window = MediaForgeWindow(server_url)
        window.show()

        sys.exit(app.exec())
    except ImportError as e:
        print(f"[Desktop] Erro: Nem pywebview nem PySide6 estão disponíveis para GUI: {e}")
        print(f"[Desktop] Acesse manualmente via: {server_url}")
    except Exception as e:
        print(f"[Desktop] Falha na execução da janela nativa: {e}")
        print(f"[Desktop] Acesse manualmente via: {server_url}")
