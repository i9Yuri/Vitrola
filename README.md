# Maré 🌊 — Baixador de Áudio e Vídeo de Alta Performance

Aplicação desktop nativa autônoma e de alta performance para extração e download de mídias (áudio bit-perfect sem recodificação desnecessária e vídeo MP4 multi-resolução com legendas e metadados) utilizando **yt-dlp** e **FFmpeg** nativos no **Nobara Linux** (ou qualquer distribuição Linux moderna).

> **Aviso de Escopo:** O projeto **Maré** é estritamente focado no download e processamento de mídia de alta performance. Ele é completamente segregado do projeto irmão **JustPlay** (tocador multimídia).
> **Repositório Oficial:** [https://github.com/i9Yuri/MediaForge](https://github.com/i9Yuri/MediaForge)

---

## ✨ Recursos da Versão 2.2.0

- **Identidade Consolidada (Maré)**: Interface elegante e minimalista com motor de temas (Claro, Slate, AMOLED #000000) e acentos configuráveis.
- **Janela Frameless Nativa**: Integração fluida à área de trabalho sem camadas aninhadas ("janela dentro de janela"), com controles integrados de minimizar, maximizar e fechar.
- **Histórico Agrupado Inteligente**: Deduplicação automática com badges numéricos multiplicadores (ex: `2x`), datas em formato ISO local seguro e verificação prévia no sistema de arquivos antes de abrir com Dolphin / Nautilus.
- **Gestão de Pasta de Destino ("Salvando em")**: Modal contextual que permite inspecionar o diretório atual, abrir diretamente no gerenciador de arquivos ou selecionar uma nova pasta nativa via Zenity ou KDialog. Padrão sugerido: `~/Música/Maré`.
- **Binário Standalone Portátil (`dist/Mare`)**: Executável único compilado via PyInstaller — execute com duplo clique no Dolphin/Nautilus sem necessidade de instalar dependências.
- **Lançador Rápido de Testes (`Testar-Mare.desktop`)**: Lançador na pasta do projeto com duplo clique para testes imediatos e abertura da interface.
- **Isolamento Total do yt-dlp (`--ignore-config`)**: Garante que diretivas globais host não interfiram na extração.
- **Atualizador em Segundo Plano**: Telemetria assíncrona e governança do motor `yt-dlp` com opção de atualização in-place na interface.

---

## 🛠️ Arquitetura & Tecnologias

- **Backend:** Python 3.10+ (`ThreadingHTTPServer` com Server-Sent Events nativos).
- **GUI Desktop:** Container nativo frameless via PySide6 (QtWebEngineWidgets) com fallback headless para navegador.
- **Motores CLI:** `yt-dlp` (isolado) e `ffmpeg` (multiplexação sem perdas, capas e legendas).
- **Frontend:** Vanilla JS modular, design responsivo em grid (`208px 1fr`, `340px` fila persistente), temas via CSS Custom Properties.
- **Integração de Sistema:** Suporte nativo ao gerenciador de arquivos (Dolphin / Nautilus) via `xdg-open`, diálogos com `zenity`/`kdialog`.

---

## 🚀 Como Executar

### 1. Teste Rápido (Duplo Clique)
Dê um duplo clique em `Testar-Mare.desktop` ou execute no terminal:
```bash
./testar.sh
```

### 2. Modo Desenvolvimento
```bash
./dev.sh
```

### 3. Compilação do Executável Portátil Standalone
Para compilar o binário único independente:
```bash
./build.sh
# O executável será gerado em dist/Mare
```

---

## 🎯 Pipelines de Download

### 1. Modo Áudio
- **Extração de Alta Fidelidade**: Coleta a melhor trilha sonora nativa (`Opus ~160kbps`, `AAC/M4A ~128kbps` ou `MP3 320kbps`) com multiplexação limpa.
- **Metadados e Capas**: Embutimento automático de tags ID3 / Vorbis comment e arte do álbum em alta resolução.

### 2. Modo Vídeo
- **Vídeo MP4 Multiplexado**: Seleção contextual de qualidade (1080p, 720p, 480p, etc.) com união automática de áudio e vídeo via FFmpeg.
- **Legendas Embutidas**: Suporte a legendas multilíngues (`pt,en`) integradas diretamente no container MP4.

---

## 🧪 Testes Automatizados

Para rodar a suíte completa de testes unitários:
```bash
python3 -m unittest discover tests
```
