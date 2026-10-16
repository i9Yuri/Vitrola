#!/usr/bin/env bash
# ==============================================================================
# Vitrola - Standalone AppImage Builder
# Generates a self-contained executable in dist/Vitrola-2.6.0.AppImage using electron-builder
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================="
echo "   📦 Vitrola - Standalone Production AppImage Builder"
echo "================================================================="

# 1. Check Node.js and npm
if ! command -v node &> /dev/null; then
    echo "❌ Erro: Node.js não encontrado no sistema."
    exit 1
fi

# 2. Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Erro: Python 3 não encontrado no sistema."
    exit 1
fi

# 3. Clean previous build artifacts
echo "🧹 Limpando artefatos anteriores..."
rm -rf build dist Vitrola.spec Mare.spec MediaForge.spec

# 4. Build single-file AppImage executable
echo "🔨 Compilando pacote executável AppImage..."
npx electron-builder --linux AppImage

# 5. Set executable permissions
APPIMAGE_FILE=$(find dist -maxdepth 1 -name "*.AppImage" | head -n 1)
if [[ -f "$APPIMAGE_FILE" ]]; then
    chmod +x "$APPIMAGE_FILE"
    echo "================================================================="
    echo "   🎉 SUCESSO! Pacote executável AppImage compilado com êxito!"
    echo "================================================================="
    echo " • Binário portátil: $APPIMAGE_FILE"
    echo " • Tamanho:          $(du -h "$APPIMAGE_FILE" | cut -f1)"
    echo " • Como executar:    $APPIMAGE_FILE (ou duplo clique no Dolphin/Nautilus)"
    echo "================================================================="
else
    echo "❌ Erro: Executável AppImage não encontrado em dist/."
    exit 1
fi
