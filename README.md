# Vitrola 🎶 — Baixador de Áudio e Vídeo de Alta Performance

Aplicação desktop moderna, autônoma e de alto desempenho para extração e download de mídias (áudio de alta fidelidade sem perdas desnecessárias e vídeo MP4 multi-resolução com legendas e metadados) desenvolvida para o ecossistema desktop Linux (otimizada para Nobara Linux / KDE Plasma) e cross-platform, integrando de forma nativa os motores **yt-dlp** e **FFmpeg**.

> **Repositório Oficial Canônico:** [https://github.com/i9Yuri/Vitrola](https://github.com/i9Yuri/Vitrola)  
> **Delimitação de Escopo & Projeto Irmão:** O **Vitrola** é estritamente dedicado à esteira de extração, download e pós-processamento de fluxos multimídia. Ele opera com total segregação e independência em relação ao tocador multimídia irmão **JustPlay**.

---

## ✨ Recursos e Funcionalidades

### 1. Janela Nativa Frameless (Edge-to-Edge)
- **Topologia Sem Moldura**: Eliminação de barras de janelas aninhadas ou decorativas redundantes do sistema operacional.
- **Titlebar Integrada**: Controles táteis nativos de minimizar, maximizar/restaurar e fechar conectados diretamente via IPC/API de janela nativa, com arraste fluido no cabeçalho superior.
- **Tipografia Grotesque**: Interface refinada em `Bricolage Grotesque` e ícones SVG minimalistas com micro-interações táteis.

### 2. Modos Especializados de Download
- **Modo Áudio Puro**:
  - Extração em formatos populares e bit-perfect: **MP3 (320 kbps, 256 kbps, 128 kbps)**, **M4A (AAC)**, **OPUS** e **FLAC**.
  - Embutimento automático de metadados completos (ID3 / Vorbis comment) e artes de álbum em resolução máxima com tratamento contra erros de CDN.
- **Modo Vídeo Multi-Resolução**:
  - Download em **MP4**, **WEBM** e **MKV** com seleção de resolução (1080p, 720p, 480p, 360p).
  - Multiplexação sem perdas via FFmpeg unindo os melhores streams de áudio e vídeo disponíveis.
  - Suporte a legendas embutidas selecionáveis (`pt,en`).

### 3. Waveform Reativa de Progresso
- **Envelope Dinâmico de 44 Barras**: Renderização determinística de waveform vertical vinculada ao ID e estado de cada transferência.
- **Monitoramento em Tempo Real**: Progresso contínuo a 60fps via Server-Sent Events (SSE) com pulso dinâmico `.on.edge` e estatísticas de taxa de transferência (KiB/s, MiB/s) e tempo estimado (ETA).

### 4. Motor de Temas e Acentos
- **Modos de Superfície**:
  - **Modo Claro (Light)**
  - **Modo Escuro Neutro (Slate)**
  - **Modo Escuro AMOLED (Pure Black `#000000`)**
- **Cores de Acento Dinâmicas e Fixas**: Acento dinâmico inteligente (Âmbar para áudio, Violeta para vídeo) ou paletas configuráveis: Âmbar, Violeta, Esmeralda, Carmim e Ciano, com zero layout shift.
- **Bootstrap Anti-FOUC**: Injeção síncrona no cabeçalho do documento prevenindo qualquer flash de conteúdo não estilizado.

### 5. Histórico Inteligente com Deduplicação
- **Agrupamento Automático**: Identificação por chave de mídia (`mediaKey`) que agrupa downloads repetidos em um único cartão com badge multiplicador (ex.: `2x`).
- **Validação de Integridade no Sistema de Arquivos**: Checagem de existência do arquivo antes de invocar o gerenciador (Dolphin / Nautilus), notificando caso a mídia tenha sido renomeada ou movida.
- **Datas em Formato Seguro**: Formatação regional defensiva evitando registros inválidos.

### 6. Governança e Telemetria do yt-dlp
- **Verificação Assíncrona de Versão**: Telemetria em segundo plano com indicador de integridade operacional.
- **Atualização In-Place**: Botão dedicado de atualização remota do executável do yt-dlp com buffer de logs ao vivo na interface.
- **Isolamento de Diretivas (`--ignore-config`)**: Blindagem contra configurações globais host que possam interferir na extração.

---

## 🛠️ Arquitetura do Sistema

```
Vitrola/
├── backend/                  # Servidor e Runner Desktop
│   ├── main.py               # Servidor HTTP Threading e SSE (/api/*)
│   ├── desktop.py            # Janela nativa frameless (PySide6 / pywebview)
│   ├── downloader.py         # Orquestrador de tarefas e fila de downloads
│   └── core/                 # Wrappers yt-dlp, FFmpeg, updater e sistema
├── src/                      # Código-Fonte Modular
│   ├── main/                 # Processo Principal / IPC Electron
│   │   ├── main.js           # Ponto de entrada Electron e registro IPC
│   │   └── ipc/              # Handlers de janela, arquivos e yt-dlp
│   ├── renderer/             # Frontend e Interface
│   │   ├── index.html        # Estrutura DOM e Titlebar
│   │   ├── components/       # Componentes modulares (TitleBar, Sidebar, Modals)
│   │   ├── js/               # Controladores (UI, Temas, Governança)
│   │   └── styles/           # CSS desacoplado (tema, janela, layout)
│   └── shared/               # Constantes globais e tipagens
├── config/                   # Configuração e esquemas padrão
├── tests/                    # Suíte de testes unitários automatizados
├── testar.sh                 # Script de execução rápida com testes
├── dev.sh                    # Inicializador em modo de desenvolvimento
├── run.sh                    # Lançador desktop
└── build.sh                  # Compilador de binário único portátil
```

---

## 🚀 Guia de Instalação e Execução

### 1. Clonar o Repositório
```bash
git clone https://github.com/i9Yuri/Vitrola.git
cd Vitrola
```

### 2. Pré-requisitos do Sistema (Linux / Nobara / Debian / Fedora)
Certifique-se de que as ferramentas essenciais estão instaladas no PATH:
- **Python 3.10+** (com `PySide6` para janela nativa desktop)
- **yt-dlp**
- **FFmpeg** e **FFprobe**

### 3. Execução Rápida para Testes
Dê um duplo clique no arquivo `Testar-Vitrola.desktop` na pasta do projeto ou execute no terminal:
```bash
./testar.sh
```

### 4. Modo de Desenvolvimento
```bash
./dev.sh
```

### 5. Compilação e Execução do Pacote Portátil Standalone (AppImage)

O **Vitrola** conta com uma esteira de empacotamento em executável único portátil de alta performance para o ecossistema Linux x64 com binários nativos (`yt-dlp` e `FFmpeg`) estaticamente acoplados via `asarUnpack`:

#### Gerar o Pacote AppImage:
```bash
npm run build:linux
```
O artefato resultante será gerado em `dist/Vitrola-2.6.0.AppImage` com permissão de execução atribuída.

#### Executar o AppImage Diretamente:
```bash
# Execução direta com suporte a FUSE:
./dist/Vitrola-2.6.0.AppImage

# Execução transparente com extração automática (sistemas sem libfuse2 instalada):
./dist/Vitrola-2.6.0.AppImage --appimage-extract-and-run
```

#### Empacotar Diretório para Inspeção / Teste:
```bash
npm run pack
```

---

## 🧪 Suíte de Testes Automatizados

A integridade do pipeline de download, flags operacionais do yt-dlp, multiplexação FFmpeg e sanitização de metadados são validadas via unittest:
```bash
python3 -m unittest discover tests
```

---

## 📜 Histórico & Roadmap

- **v1.0**: Pipeline inicial de download de mídia portátil com yt-dlp e FFmpeg.
- **v2.0**: Redesign visual completo com grid 208px/1fr, waveform progress e motor de temas.
- **v2.1**: Janela nativa frameless com controles integrados, histórico agrupado inteligente com verificação no disco e modal contextual de destino.
- **v2.2**: Padronização de manifestos, consolidação e governança de armazenamento.
- **v2.3 (Atual)**: Rebranding definitivo para **Vitrola**, redefinição do repositório oficial para `https://github.com/i9Yuri/Vitrola`, formalização dos contratos IPC de metadados e expurgo completo de referências legadas.

---

## 📄 Licença
Distribuído sob a licença MIT. Consulte `LICENSE` para mais detalhes.
