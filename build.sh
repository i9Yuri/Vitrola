#!/usr/bin/env bash
# ==============================================================================
# Vitrola - Standalone Portable Single-File Builder
# Generates a self-contained executable in dist/Vitrola using PyInstaller
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================="
echo "   📦 Vitrola - Standalone Portable Executable Builder"
echo "================================================================="

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Erro: Python 3 não encontrado no sistema."
    exit 1
fi

# 2. Check / Install PyInstaller
if ! command -v pyinstaller &> /dev/null && ! python3 -m PyInstaller --version &> /dev/null; then
    echo "⏳ PyInstaller não detectado. Instalando no ambiente de usuário via pip..."
    python3 -m pip install --user pyinstaller
fi

# 3. Clean previous build artifacts
echo "🧹 Limpando artefatos anteriores..."
rm -rf build dist Vitrola.spec Mare.spec MediaForge.spec

# 4. Build single-file executable
echo "🔨 Compilando binário único independente (--onefile)..."

python3 -m PyInstaller \
    --onefile \
    --noconsole \
    --name "Vitrola" \
    --add-data "frontend:frontend" \
    --add-data "config:config" \
    --hidden-import "PySide6.QtWebEngineWidgets" \
    --hidden-import "PySide6.QtCore" \
    --hidden-import "PySide6.QtWidgets" \
    --hidden-import "yt_dlp" \
    --collect-all "yt_dlp" \
    backend/main.py

# 5. Set executable permissions
chmod +x dist/Vitrola

echo "================================================================="
echo "   🎉 SUCESSO! Executável único compilado com êxito!"
echo "================================================================="
echo " • Binário portátil: dist/Vitrola"
echo " • Tamanho:          $(du -h dist/Vitrola | cut -f1)"
echo " • Como executar:    ./dist/Vitrola (ou duplo clique no Dolphin/Nautilus)"
echo "================================================================="
