#!/usr/bin/env bash
# ==============================================================================
# Maré - Fast Development Runner
# Starts the application directly in native desktop or headless mode
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🌊 Iniciando Maré em modo desenvolvimento..."
exec python3 -m backend.main "$@"
