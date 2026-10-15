#!/usr/bin/env bash
# ==============================================================================
# Vitrola - Script de Teste e Execução (Duplo Clique)
# Nobara Linux / KDE Plasma
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Feedback visual imediato na área de trabalho do Linux
if command -v notify-send &>/dev/null; then
    notify-send -i applications-multimedia "Vitrola" "Abrindo Vitrola..."
fi

# Se invocado com flag de teste, executa a suíte antes
if [[ "$1" == "--test" || "$1" == "-t" ]]; then
    echo "🧪 Executando suíte de testes do Vitrola..."
    python3 -m unittest discover tests
fi

# Inicia a janela nativa desktop (PySide6 QtWebEngine)
echo "🎶 Abrindo interface gráfica do Vitrola..."
exec python3 -m backend.main "$@"
