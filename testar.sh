#!/usr/bin/env bash
# ==============================================================================
# Maré - Script de Teste e Execução (Duplo Clique)
# Nobara Linux / KDE Plasma
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Feedback visual imediato na área de trabalho do Linux
if command -v notify-send &>/dev/null; then
    notify-send -i applications-multimedia "Maré" "Iniciando testes e abrindo interface..."
fi

# Executa a suíte de testes unitários
echo "🧪 Executando suíte de testes do Maré..."
python3 -m unittest discover tests

# Inicia a janela nativa desktop (PySide6 QtWebEngine)
echo "🌊 Abrindo interface gráfica do Maré..."
exec python3 -m backend.main "$@"
