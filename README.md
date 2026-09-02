# MediaForge 🚀

Aplicação desktop local/web de alta performance para extração e download de mídias (áudio puro bit-perfect sem recodificação e vídeo MP4 multi-resolução com legendas e metadados) utilizando **yt-dlp** e **FFmpeg** nativos no **Nobara Linux** (ou qualquer distribuição Linux moderna).

---

## 🛠️ Arquitetura & Tecnologias

- **Backend:** Python 3.10+ (`ThreadingHTTPServer` com Server-Sent Events nativos). Sem dependências pesadas externas.
- **Motores CLI:** `yt-dlp` (extração de streams e metadados com suporte a runtime Node.js para EJS) e `ffmpeg` (multiplexação sem perdas de container MP4, capas e legendas).
- **Frontend:** Design System industrial sóbrio sem frameworks pesados, paleta escura (slate/chumbo `#0f172a`, destaque em verde esmeralda `#10b981`, azul técnico `#0284c7` e avisos em âmbar `#f59e0b`), streaming de progresso reativo a 60fps via SSE (`EventSource`).
- **Integração de Sistema:** Integração direta com o gerenciador de arquivos padrão do Nobara Linux (Dolphin / Nautilus) via `xdg-open`.

---

## 📁 Estrutura do Projeto

```
Music Downloader/
├── backend/
│   ├── main.py               # Servidor HTTP com REST API e SSE streaming
│   ├── downloader.py         # Gerenciador assíncrono de tarefas e histórico
│   └── core/
│       ├── __init__.py
│       ├── system.py         # Resolução de caminhos, sanitização ext4 e xdg-open
│       └── ytdlp_wrapper.py  # Wrapper robusto para yt-dlp (--dump-single-json, download)
├── frontend/
│   ├── index.html            # Estrutura semântica e cards operacionais
│   ├── styles.css            # Design System industrial e responsivo
│   └── app.js                # Lógica reativa, cliente SSE e controles dinâmicos
├── config/
│   ├── config.json           # Diretórios padrão, portas e preferências de codec
│   └── history.json          # Histórico persistente de downloads (gerado)
├── downloads/                # Diretório local de fallback (gitignored)
├── tests/
│   └── test_pipeline.py      # Suíte de testes unitários e validação com ffprobe
├── run.sh                    # Launcher executável no Nobara Linux
├── .gitignore                # Regras de isolamento Git
└── README.md
```

---

## 🚀 Como Executar

### 1. Inicialização Automática (Recomendada)
Execute o script launcher:
```bash
./run.sh
```
O launcher verifica os binários do sistema (`python3`, `yt-dlp`, `ffmpeg`, `ffprobe`), inicia o servidor na porta `8765` e abre o navegador automaticamente no Nobara Linux.

### 2. Inicialização Manual
```bash
python3 backend/main.py
```
Em seguida, acesse no seu navegador:
```
http://127.0.0.1:8765
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
