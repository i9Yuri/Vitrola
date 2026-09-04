# MediaForge 🚀 (v1.0)

Aplicação desktop nativa autônoma e de alta performance para extração e download de mídias (áudio puro bit-perfect sem recodificação e vídeo MP4 multi-resolução com legendas e metadados) utilizando **yt-dlp** e **FFmpeg** nativos no **Nobara Linux** (ou qualquer distribuição Linux moderna).

Interface moderna inspirada na linguagem estética da Apple (minimalismo industrial, cantos contínuos, controles segmentados compactos e monitoramento de progresso a 60fps via SSE).

---

## ✨ Recursos da Versão 1.0

- **Binário Standalone Portátil (`MediaForge`)**: Executável único compilado via PyInstaller — execute com duplo clique no Dolphin/Nautilus sem necessidade de instalar dependências.
- **Janela Desktop Nativa Autônoma**: Roda diretamente em container de janela desktop nativa via QtWebEngine sem abrir navegador externo.
- **Isolamento Total do yt-dlp (`--ignore-config`)**: Garante que diretivas globais host (como `-x`) não interfiram na escolha entre Áudio e Vídeo.
- **Fluxo Rápido com Tecla `Enter`**:
  - *Mídia estritamente de áudio (YouTube Music)*: Disparo automático instantâneo do melhor áudio bit-perfect sem fricção.
  - *Conteúdo com vídeo disponível*: Pausa contextual para escolha do formato desejado (`Áudio Puro` vs `Vídeo MP4`).
- **Resolução de Capas em Alta Resolução**: Tratamento inteligente contra requisições 404 da CDN do Google, priorizando JPEGs de qualidade máxima.
- **Atualizador em Segundo Plano**: Monitoramento assíncrono e não-bloqueante de novas versões do motor `yt-dlp` com opção de disparo manual na interface.

---

## 🛠️ Arquitetura & Tecnologias

- **Backend:** Python 3.10+ (`ThreadingHTTPServer` com Server-Sent Events nativos).
- **GUI:** Container nativo PySide6 (QtWebEngineWidgets) com fallback headless para navegador.
- **Motores CLI:** `yt-dlp` (isolado) e `ffmpeg` (multiplexação sem perdas, capas e legendas).
- **Frontend:** Design System escuro inspirado na Apple, paleta industrial sóbria, micro-interações táteis e streaming reativo SSE (`EventSource`).
- **Integração de Sistema:** Suporte nativo ao gerenciador de arquivos (Dolphin / Nautilus) via `xdg-open`.

---

## 🚀 Como Executar

### 1. Executável Portátil Standalone (Recomendado para Usuários)
Baixe o arquivo `MediaForge` da [seção de Releases](https://github.com) e execute com duplo clique ou pelo terminal:
```bash
chmod +x MediaForge
./MediaForge
```

### 2. Modo Desenvolvimento (Instantâneo)
```bash
./dev.sh
```

### 3. Compilação do Executável Portátil
Para compilar um novo binário único independente:
```bash
./build.sh
# O executável será gerado em dist/MediaForge
```

---

## 🎯 Pipelines de Download

### 1. Modo Áudio Puro (Sem Recodificação)
- **Extração Bit-Perfect**: Coleta o melhor stream de áudio nativo (preferência para `Opus ~160kbps` ou `AAC/M4A ~128kbps`) sem conversão para MP3.
- **Metadados e Capas**: Embutimento automático de tags ID3 / Vorbis comment e arte do álbum em alta resolução.
- **Comando interno executado:**
  ```bash
  yt-dlp --no-playlist --windows-filenames -f "ba[ext=opus]/ba[ext=m4a]/ba" --add-metadata --embed-thumbnail "<URL>"
  ```

### 2. Modo Vídeo MP4 (Multi-Resolução)
- **Container MP4 Universal**: Combina o melhor fluxo de vídeo na resolução selecionada (`4K`, `1440p`, `1080p60`, `1080p`, `720p`) com o áudio original.
- **Legendas Embutidas**: Multiplexação direta de legendas selecionadas (oficiais ou auto-geradas) no container final via FFmpeg (`mov_text`).
- **Comando interno executado:**
  ```bash
  yt-dlp --no-playlist --windows-filenames -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]" --merge-output-format mp4 --add-metadata --embed-thumbnail --write-subs --sub-langs pt,en --embed-subs "<URL>"
  ```

---

## 🧪 Executando os Testes Automatizados

Para rodar a suíte completa de testes (incluindo validação de streams e tags com `ffprobe`):
```bash
python3 -m unittest tests/test_pipeline.py
```
