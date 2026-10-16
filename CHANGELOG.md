# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.6.0] - 2026-10-16

### Added
- **Cinemática de Rotação do Vinil por Ponteiro (Drag-to-Spin)**: Controle tátil e manual do disco de vinil decorativo superior via clique e arraste angular contínuo (`Math.atan2`), retenção contínua de ponteiro com `setPointerCapture` e retomada fluida da rotação automática sem saltos angulares.
- **Botão Informacional e Modal Técnico de Diagnóstico de Falhas**: Botão `[i]` na listagem de downloads recentes acoplado a modal de inspeção com causa raiz, sugestão de ação corretiva e gaveta expansível de logs brutos com botão de cópia rápida.
- **Ação de Reprocessamento Imediato ("Tentar novamente")**: Botão `.btn-retry-task` permitindo reexecutar tarefas com falha sem duplicar entradas no histórico.
- **Modo de Qualidade "Original / Direto da Fonte"**: Opção de download prioritária sem conversão ou recodificação destrutiva (`acodec=copy`), contornando pipes desnecessários do FFmpeg.
- **Widget de Telemetria de Armazenamento**: Monitoramento em tempo real no rodapé da barra lateral exibindo contagem de faixas de áudio e vídeos locais, tamanho total consumido e barra visual de uso do diretório de destino.

### Changed
- **Reformulação Estética Inspirada em Vinil**: Nova topologia estrutural com barra de título nativa integrada, corpo de aplicação em grid assimétrico, cartão de resultado com mockup estilizado de disco saindo da capa (`.sleeve` e `.rec`) e rodapé de status de motor e versão.
- **Remoção de Elementos Inoperantes da Titlebar**: Eliminação definitiva de menus suspensos inativos e marca duplicada no topo da janela, concentrando a identidade gráfica exclusivamente na barra lateral.
- **Migração da Gestão de Destino para Ajustes**: Centralização da seleção de pasta de downloads e diálogo nativo do sistema no modal de Ajustes, mantendo indicador passivo de destino no cartão principal.
- **Banimento do Seletor FLAC**: Remoção estrita do formato FLAC inexistente em plataformas de streaming web, consolidando os formatos reais suportados: MP3, Opus e M4A para áudio; MP4, WebM e MKV para vídeo.

### Fixed
- **Estabilização de Fechamento e Crash Pós-Minimização no Linux**: Eliminação do congelamento no botão fechar através de terminação atômica (`forceTeardown`) com `SIGKILL` em subprocessos ativos em menos de 100ms, e mitigação de falhas de contexto gráfico após minimizar via injeção de flags do Chromium (`disable-renderer-backgrounding`).
- **Correção de Stacking Context (Z-Index) da Busca**: Elevação da barra de pesquisa flutuante e botões interativos (`z-index: 30`) sobre a área decorativa do disco de vinil (`z-index: 5`), com salvaguardas de colisão e ponteiro.
- **Eliminação do Erro Fatal de Download (HTTP 416: Requested range not satisfiable)**: Purga automática de arquivos residuais corrompidos (`.part`, `.ytdl`, `.temp`) antes de cada execução e injeção obrigatória de `--no-continue` e download atômico sequencial limpo.
- **Consolidação em Arquivo Único e Eliminação de Resíduos**: Remux atômico direto com FFmpeg (`-x`, `--audio-format`, `--no-keep-video`) e embutição de capa/metadados no contêiner consolidado (`--embed-thumbnail`), eliminando o descarte de capas avulsas (`.webp`, `.png`) ou contêineres intermediários (`.webm`).
- **Restauração e Blindagem do Botão "Colar"**: Conexão com a API nativa da área de transferência do Electron (`electron.clipboard.readText()`) via IPC e ouvinte de clique delegado duradouro em nível de documento, com higienização de texto e disparo automático de inspeção para URLs válidas.
- **Deduplicação Inteligente no Histórico**: Agrupamento automático por chave de mídia (`mediaKey`) agregando downloads repetidos em um único cartão com badge de multiplicador (ex.: `4x`).

### Security & Performance
- **Esteira de Empacotamento Standalone Portátil (Linux AppImage)**: Compilação de executável autossuficiente de 103 MB com compressão balanceada (`normal`), prevenindo gargalos de descompressão FUSE em `/tmp`.
- **Agrupamento Estático e Resolução de Binários Nativos**: Isolamento de `yt-dlp` e `ffmpeg` em `bin/` via `asarUnpack: ["**/bin/*"]` e resolução dinâmica com `getExecutableBinaryPath`, assegurando autonomia total sem dependências globais no host.
- **Otimização de Inicialização Acelerada (Cold Start < 800ms)**: Criação de janela oculta (`show: false`) com tom escuro `#081017`, exibição imediata no evento `ready-to-show` e diferimento de tarefas secundárias após o primeiro quadro, eliminando telas brancas e cintilações visuais.
- **Desacoplamento de Canais IPC e Bloqueio de Instância Única**: Chamadas assíncronas não bloqueantes em controladores de janela e registro de `app.requestSingleInstanceLock()` restaurando a janela ativa sem instanciar processos concorrentes.

## [2.5.5] - 2026-10-15

### Fixed
- **Entrega de Mídia em Arquivo Único e Eliminação de Artefatos Órfãos**:
  - Imposição de remux/extração atômica em modos de áudio (incluindo "Áudio Original") através das diretivas `-x` (`--extract-audio`), `--audio-format best` e `--no-keep-video`. O fluxo Opus original em contêiner WebM é remuxado de forma bit-perfect (`acodec=copy`) para o contêiner legítimo `.opus`.
  - Embutição definitiva de metadados e imagem de capa em alta definição diretamente no contêiner de áudio consolidado via `--embed-thumbnail` e `--add-metadata`, eliminando o uso de `--write-thumbnail`.
  - Implementação da rotina de purga pós-processamento `purgeOrphanThumbnails`, varrendo o diretório e expurgando arquivos homônimos `.webp`, `.png`, `.jpg`, `.temp` ou contêineres intermediários `.webm`.
- **Restauração e Blindagem do Botão de Colagem ("Colar")**:
  - Padronização do handler IPC para a API nativa da área de transferência (`electron.clipboard.readText()`) e vinculação delegada duradoura de eventos de clique em nível de documento (`#btn-paste`).

## [2.5.4] - 2026-10-15

### Fixed
- **Reestruturação dos Contextos de Empilhamento (Z-Index)**:
  - Isolamento de camadas: `.search` com `z-index: 30` e `.hero` com `z-index: 25`, posicionando o campo de busca e seus botões à frente do disco de vinil.
- **Erradicação do Erro Fatal de Download (HTTP 416)**:
  - Implementação de `purgePartialDownloadArtifacts` para purga defensiva de resíduos `.part`, `.ytdl` e `.temp`.
  - Injeção obrigatória de `--no-continue` e `--concurrent-fragments 1`.
- **Restauração e Delegação de Eventos do Botão Informacional de Erro**:
  - Implementação de delegação de cliques permanente em `#recent-downloads-list` para `.btn-error-info`, `.btn-retry-task` e `.btn-cancel-task`.

## [2.5.3] - 2026-10-15

### Fixed
- **Saneamento de Pós-Processamento de Miniatura (yt-dlp/Mutagen)**:
  - Criação da lista canônica `SUPPORTED_THUMBNAIL_CONTAINERS` e verificação condicional em `can_embed_thumbnail`.
- **Subsistema de Diagnóstico de Erros e Retentativa Imediata**:
  - Implementação do modal `ErrorModal` com explicação da falha, sugestão de ação corretiva e gaveta expansível de logs.
- **Cinemática e Desbloqueio do Disco de Vinil**:
  - Desativação de captura de eventos de ponteiro no pseudo-elemento overlay e rastreamento polar suave com `setPointerCapture`.

## [2.5.2] - 2026-10-15

### Changed
- **Saneamento de Identidade no Header**:
  - Remoção de `.brand` / `.mark` da barra de título superior (`.top`), centralizando a identidade exclusivamente na barra lateral.
- **Skeleton Screen Neutro com Shimmer**:
  - Máscara de gradiente linear deslizante horizontal monocromática neutra sem texto fictício prévio.

## [2.5.0] - 2026-10-15

### Added
- **Paradigma Visual Vinil de Alta Fidelidade**:
  - Topologia de janela em 3 faixas estruturais (titlebar integrada, corpo em grid assimétrico e barra de status inferior).
  - Arte decorativa de disco de vinil giratório com animação contínua e suspensão sob `prefers-reduced-motion`.
- **Telemetria de Disco na Barra Lateral**:
  - Widget com contagem automática de faixas locais, vídeos e tamanho total ocupado.
- **Centralização da Gestão de Destino nos Ajustes**:
  - Relocação do controle e diálogo de alteração de pasta de download para o modal de Ajustes.

## [2.4.0] - 2026-10-15

### Fixed
- **Estabilização de Ciclo de Vida da Janela no Linux**:
  - Injeção de flags do Chromium contra descarte de contexto gráfico pelo compositor ao minimizar.
  - Fechamento gracioso com `SIGKILL` a subprocessos pendentes e destruição atômica da janela.
- **Sistema de Tingimento Tonal Global por Cor-Tema**:
  - Matrizes cromáticas padrão (Âmbar, Violeta, Esmeralda, Carmim e Ciano) para superfícies dos modos Claro, Escuro Neutro e AMOLED puro (`#000000`).

## [2.3.0] - 2026-10-15

### Added
- **Identidade e Sincronização Canônica**:
  - Consolidação formal sob a marca **Vitrola**.
  - Repositório oficial canônico [https://github.com/i9Yuri/Vitrola](https://github.com/i9Yuri/Vitrola).
  - Formalização dos contratos IPC de metadados, manifesto `package.json` e rotinas de telemetria de disco.
