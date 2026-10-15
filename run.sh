#!/usr/bin/env bash
# ==============================================================================
# Vitrola - Launcher Script for Nobara Linux / POSIX
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================="
echo "   🎶 Vitrola - Baixador de Áudio e Vídeo de Alta Performance"
echo "================================================================="

# Check requirements
for bin in python3 yt-dlp ffmpeg ffprobe; do
    if ! command -v "$bin" &> /dev/null; then
        echo "❌ Erro: Binário essencial '$bin' não foi encontrado no PATH do sistema."
        exit 1
    fi
done

echo "✔ Ambiente Nobara Linux verificado (python3, yt-dlp, ffmpeg, ffprobe ok)."
echo "✔ Inicializando Vitrola Desktop (janela nativa)..."

exec python3 "$DIR/backend/main.py" "$@"
