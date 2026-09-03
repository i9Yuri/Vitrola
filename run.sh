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
echo "✔ Inicializando MediaForge Desktop (janela nativa)..."

exec python3 "$DIR/backend/main.py" "$@"

