#!/usr/bin/env bash
# ==============================================================================
# MediaForge - Launcher Script for Nobara Linux / POSIX
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================="
echo "   🚀 MediaForge - High-Performance Media Downloader"
echo "================================================================="

# Check requirements
for bin in python3 yt-dlp ffmpeg ffprobe; do
    if ! command -v "$bin" &> /dev/null; then
        echo "❌ Erro: Binário essencial '$bin' não foi encontrado no PATH do sistema."
        exit 1
    fi
done

echo "✔ Ambiente Nobara Linux verificado (python3, yt-dlp, ffmpeg, ffprobe ok)."
echo "✔ Inicializando servidor HTTP local..."

# Launch browser in background after short delay if desktop session is detected
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    (sleep 1.2 && xdg-open "http://127.0.0.1:8765" &> /dev/null) &
fi

exec python3 "$DIR/backend/main.py"
