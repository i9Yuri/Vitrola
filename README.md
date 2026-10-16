# Vitrola

[![Version](https://img.shields.io/badge/version-2.6.0-amber.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20x64%20%7C%20Cross--Platform-emerald.svg)](https://github.com/i9Yuri/Vitrola)
[![Engine](https://img.shields.io/badge/engine-yt--dlp%20%7C%20FFmpeg-cyan.svg)](https://github.com/yt-dlp/yt-dlp)

> Baixador de mídia de alta performance (áudio e vídeo) para desktop integrado de forma nativa ao **yt-dlp** e **FFmpeg**.

Repositório Oficial Canônico: [https://github.com/i9Yuri/Vitrola](https://github.com/i9Yuri/Vitrola)

---

## Destaques Arquiteturais e Funcionalidades

### 1. Janela Frameless com Controles Integrados
- **Topologia Sem Bordas (Edge-to-Edge)**: Interface limpa e imersiva sem barras de janela redundantes do sistema operacional.
- **Barra de Título Integrada**: Arraste contínuo e fluido no topo da janela com controles nativos de minimizar, maximizar/restaurar e fechar.
- **Desacoplamento Assíncrono sem Deadlocks**: Controle de janela desacoplado do loop principal, garantindo minimização sem falhas de GPU e encerramento atômico com purga imediata de subprocessos (`SIGKILL`) em menos de 100ms.

### 2. Design Inspirado em Vinil e Ergonomia
- **Cinemática de Rotação por Ponteiro (Drag-to-Spin)**: Disco de vinil decorativo superior com controle rotacional manual por clique e arraste angular contínuo (`Math.atan2`), retenção de ponteiro com `setPointerCapture` e retomada suave da rotação automática sem saltos angulares.
- **Barra de Pesquisa em Pílula Flutuante**: Campo de entrada com atalho <kbd>Ctrl V</kbd>, botão nativo de colar do clipboard e botão de busca com realce visual.
- **Colagem Nativa Resiliente**: Botão "Colar" integrado à API nativa da área de transferência do sistema operacional (`electron.clipboard`), com higienização de texto e disparo automático de inspeção para URLs válidas.
- **Skeleton Screen Neutro com Shimmer**: Transição de carregamento com máscara luminosa deslizante (`@keyframes shimmer`) em placeholders monocromáticos neutros, sem texto fictício ou saltos de layout (Zero Layout Shift).

### 3. Motor yt-dlp & FFmpeg de Alta Fidelidade
- **Modo Original / Direto da Fonte**: Extração sem conversão ou recodificação destrutiva de bitrate, preservando a integridade original da mídia diretamente do servidor de streaming.
- **Formatos Dedicados e Padronizados**:
  - **Áudio**: MP3 (320 kbps, 256 kbps, 128 kbps), Opus e M4A.
  - **Vídeo**: MP4, WebM e MKV com seleção de resolução (1080p, 720p, 480p, 360p).
  - *Saneamento estrito: bloqueio e remoção de opções inoperantes em streams web (como FLAC).*
- **Consolidação em Arquivo Único com Capa Embutida**:
  - Remux atômico direto com FFmpeg (`-x`, `--audio-format`, `--no-keep-video`).
  - Embutição automática de metadados e imagem de capa em alta definição via `--embed-thumbnail` e `--add-metadata`.
  - Purga sistemática de artefatos temporários órfãos (`.webp`, `.png`, `.part`, `.ytdl`), garantindo que apenas o arquivo de música final seja gravado no disco.

### 4. Telemetria de Armazenamento em Tempo Real
- **Widget de Disco na Barra Lateral**: Monitoramento automático no rodapé da barra lateral exibindo a contagem de faixas de áudio e vídeos locais, espaço total ocupado no diretório de destino e barra de progresso visual de uso do disco.

### 5. Histórico Agregado e Diagnóstico de Falhas
- **Deduplicação Inteligente**: Agrupamento automático de downloads idênticos por chave de mídia (`mediaKey`) com indicador visual multiplicador (ex.: `2x`, `4x`).
- **Validação de Disco**: Verificação de integridade no sistema de arquivos antes de abrir o gerenciador (Dolphin / Nautilus), notificando o usuário caso o arquivo tenha sido movido ou excluído.
- **Modal de Diagnóstico e Retentativa**: Botão informacional de erro `[i]` com modal técnico detalhado, sugestão de ação corretiva, cópia de logs brutos e botão de ação direta "Tentar novamente".

---

## Interface & Theming

O Vitrola conta com um subsistema de personalização visual baseado em tokens semânticos e tingimento dinâmico de superfícies:

### Modos de Superfície
- **Modo Claro (Light)**: Superfícies claras e arejadas com alto contraste tipográfico e sutis nuances tonais.
- **Modo Escuro Neutro (Slate / Grafite)**: Fundo escuro com tingimento tonal perceptível (8% a 14% de saturação) alinhado à cor de acento ativa.
- **Modo Escuro AMOLED (Pure Black `#000000`)**: Preto absoluto em todas as superfícies de base (`--win`, `--desk`, `--side`), reservando a cor de destaque estritamente para bordas finas, badges e estados interativos.

### Paletas de Cores de Acento
- **Acento Dinâmico**: Alternância inteligente automática (Âmbar para áudio, Violeta para vídeo).
- **Âmbar** (`#FFB547`)
- **Violeta** (`#8E96FF`)
- **Esmeralda** (`#10B981`)
- **Carmim** (`#F43F5E`)
- **Ciano** (`#06B6D4`)

*Zero FOUC (Flash of Unstyled Content): Leitura síncrona de preferências no `<head>` do documento antes da renderização do primeiro quadro.*

---

## Arquitetura do Projeto

```
Vitrola/
├── bin/                      # Binários nativos empacotados (yt-dlp, ffmpeg)
├── src/                      # Código-Fonte Modular do Electron
│   ├── main/                 # Processo Principal
│   │   ├── main.js           # Ponto de entrada, lifecycle e registro IPC
│   │   ├── preload.js        # ContextBridge seguro e exposto ao renderer
│   │   ├── downloader/       # Contratos yt-dlp, flags atômicas e resolução de binários
│   │   └── ipc/              # Controladores de janela, clipboard nativo e telemetria
│   ├── renderer/             # Interface de Usuário
│   │   ├── index.html        # Estrutura DOM e titlebar integrada
│   │   ├── components/       # Componentes modulares (RecentDownloads, ErrorModal, VinylDisc)
│   │   ├── js/               # Controladores de UI, temas e histórico
│   │   └── styles/           # CSS desacoplado (tema, janela, layout, animações)
│   └── shared/               # Constantes e tipagens compartilhadas
├── config/                   # Configurações padrão e esquema de histórico
├── tests/                    # Suíte de testes unitários automatizados
├── electron-builder.yml      # Manifesto de build para AppImage Linux x64
├── package.json              # Manifesto de dependências e scripts npm
├── dev.sh                    # Inicializador do ambiente de desenvolvimento
└── testar.sh                 # Script auxiliar de execução com testes
```

---

## Primeiros Passos (Getting Started)

### Pré-requisitos
- **Node.js**: v18.x ou superior (com `npm`)
- **Python**: v3.10+ (para execução de testes unitários automatizados)
- **Linux**: Compatível com Nobara, Fedora, Ubuntu, Debian, Arch Linux e derivados.

### 1. Clonar o Repositório
```bash
git clone https://github.com/i9Yuri/Vitrola.git
cd Vitrola
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Executar em Modo de Desenvolvimento
Para iniciar a aplicação diretamente:
```bash
npm start
```
Ou alternativamente através do Electron:
```bash
npm run electron
```

---

## Empacotamento para Produção (Standalone AppImage)

O **Vitrola** possui esteira configurada via `electron-builder` para gerar um executável autossuficiente no formato **AppImage** (x64) para Linux com binários nativos (`yt-dlp` e `ffmpeg`) estaticamente acoplados via `asarUnpack`.

### 1. Gerar o Pacote AppImage
```bash
npm run build:linux
```
O arquivo executável será compilado em:
```
dist/Vitrola-2.6.0.AppImage
```

### 2. Atribuir Permissão de Execução
```bash
chmod +x dist/Vitrola-2.6.0.AppImage
```

### 3. Executar o Aplicativo
```bash
# Execução direta com FUSE ativo:
./dist/Vitrola-2.6.0.AppImage

# Execução em sistemas sem suporte a FUSE / libfuse2:
./dist/Vitrola-2.6.0.AppImage --appimage-extract-and-run
```

### 4. Empacotar Diretório para Inspeção / Teste
Para inspecionar a estrutura de arquivos sem gerar a imagem SquashFS:
```bash
npm run pack
```

### Otimizações de Inicialização (Cold Start)
- **Zero-Wait Bootstrap**: Criação da janela com `show: false`, fundo `#081017` e exibição estritamente após o evento `ready-to-show`, atingindo o primeiro quadro em menos de 800ms sem flashes brancos.
- **Compressão Balanceada**: Configuração `compression: "normal"` para otimizar o tempo de montagem FUSE em diretórios temporários (`/tmp`).
- **Resolução Dinâmica de Binários (`getExecutableBinaryPath`)**: Priorização de `process.resourcesPath/bin` e `resources/app.asar.unpacked/bin` com permissões defensivas `0755`.
- **Instância Única (`Single-Instance Lock`)**: Se o aplicativo já estiver em execução, uma nova tentativa restaura e foca a janela existente sem duplicar processos na memória.

---

## Testes Automatizados

A integridade do pipeline de download, resolução de binários nativos, flags do yt-dlp e purga de artefatos temporários são validados por suíte de testes unitários:

```bash
npm test
# ou:
python3 -m unittest discover tests
```

---

## Diagnóstico e Solução de Problemas (Troubleshooting)

- **FUSE não instalado**: Se a execução do AppImage exibir mensagem sobre `/tmp` ou FUSE ausente, utilize o parâmetro `--appimage-extract-and-run`.
- **Erro de Sandbox em Ambientes Headless / Contêineres**: Caso execute em ambientes sem namespaces de usuário desprivilegiados habilitados, adicione o argumento `--no-sandbox`.
- **Área de Transferência**: O botão "Colar" utiliza a API nativa do Electron (`electron.clipboard`), dispensando autorizações de permissão do navegador.
- **Resíduos de Download (.part)**: Caso uma conexão de rede seja abruptamente interrompida, a rotina interna expurga automaticamente arquivos `.part` e `.ytdl` antes da retentativa, prevenindo o erro HTTP 416.

---

## Licença

Distribuído sob a licença **MIT**. Consulte [LICENSE](LICENSE) para mais detalhes.
