# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.6.1] - 2026-10-16

### Added
- **Modal Customizado de Confirmação Dark-Theme (`ConfirmModal.js`)**: Substituição definitiva de diálogos nativos bloqueantes do sistema operacional (`window.confirm`) por um modal assíncrono baseado em `Promise<boolean>`, integrado organicamente ao design system da aplicação, com backdrop translúcido com desfoque (`backdrop-filter: blur(4px)`), foco inicial defensivo no botão Cancelar (prevenindo acionamento involuntário por tecla Enter) e suporte ao fechamento via `Escape` ou clique externo.

### Fixed
- **Despacho e Persistência Atômica do Histórico de Downloads**:
  - Correção dos canais IPC Electron (`history:deleteItem`, `history:clearAll`, `history:getAggregated`) no processo principal, substituindo stubs vazios por requisições HTTP reais encaminhadas ao serviço backend Python local.
  - Gravação atômica em `config/history.json` através de arquivo temporário (`.tmp.{pid}`), `flush()` e `os.fsync()`, com mecanismo de contingência e retry automático de 100ms em caso de bloqueios transitórios de I/O no sistema de arquivos.
  - Suporte bidirecional e robusto a rotas `DELETE /api/history/{id}` e `DELETE /api/history` com fallback defensivo para rotas `POST /api/history/delete` e `POST /api/history/clear`.
- **Exclusão Reativa de Itens e Atualização em Tempo Real**:
  - Animação de recolhimento suave (`history-item-collapsing`: transição de opacidade, escala e altura máxima) ao remover itens individuais do histórico.
  - Atualização dinâmica e reativa do contador de rodapé (`"X itens"`) e transição imediata para o placeholder de lista vazia quando o total de itens atinge zero.
  - Desativação automática com opacidade reduzida do botão "Limpar histórico" quando a lista está vazia.
  - Preservação estrita dos arquivos físicos de mídia baixados no disco durante qualquer operação de histórico.
- **Sincronização Visual de Versão na Interface**: Atualização dos indicadores de versão na barra de status inferior e no painel "Sobre o Vitrola" para `v2.6.1`.

## [2.6.0] - 2026-10-16

### Added
- **Acionamento Nativo da Pasta de Downloads via Clique no Card**: Integração de abertura direta do diretório de músicas local configurado via canal IPC `system:open-download-folder` com verificação defensiva de existência (`fs.mkdirSync`), consumido diretamente pelo clique no card `.disk` da barra lateral, com cursor de ponteiro e feedback visual não invasivo.
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
- **Sincronização Bidirecional e Determinística da Barra Lateral**: Despachante centralizado `navigateView` e `syncSidebarIndicators` garantindo exclusão mútua e estrita unicidade do item ativo (`Início`, `Histórico`, `Ajustes`), com classes sincronizadas (`.on` e `.active`), atributos `aria-current="page"` e chamada defensiva de `.blur()` nos botões inativos para eliminar artefatos visuais de `:focus-visible`.
- **Tratamento Unificado de Encerramento de Modais com Reset para Início**: Interceptação de todos os vetores de saída (botão Fechar/X, clique no backdrop externo e tecla `Escape`) redirecionando compulsoriamente para o estado "Início" e fechando painéis concorrentes.
- **Transparência de Metadados Reais de Stream Original**: Extração e exibição dinâmica dos dados brutos de stream inspecionado no backend (`ext`, `bitrate`/`abr` com aproximação matemática defensiva quando ausente, `codec`, `resolution`, `fps`, `vbr`), substituindo seletores manuais estáticos por texto informativo (ex.: `Fonte original (Opus ~160 kbps)`) acompanhado de micro-badge `Sem recompressão` e opacidade balanceada (`0.72`).
- **Otimizações de Performance e Runtime no Renderer**: Injeção de debounce de 350ms no input de pesquisa (`#input-url`), encerramento atômico de conexões `EventSource` e purga imediata de buffers e referências residuais de imagens/mídia após a conclusão de tarefas em `markTaskCompleted`.
- **Orquestração Robusta do Backend Python em Produção (AppImage/Electron)**: Inicialização determinística do serviço backend Python (`python3 backend/main.py --headless`) no hook de ciclo de vida `app.whenReady()`, resolução dinâmica de caminhos (`getExecutableResourcePath`) via `process.resourcesPath` sob `app.isPackaged`, telemetria de inicialização e leitura de pipes `stdout`/`stderr` com validação de prontidão HTTP antes da liberação da janela.
- **Eliminação de Exceções `Failed to fetch` e Resiliência de Rede**: Roteamento transparente de requisições relativas `/api/` no renderer em ambiente empacotado `file://` para a porta local alocada do backend (`http://127.0.0.1:8765`), acompanhado de mecanismo de health-check com até 3 tentativas (intervalo de 500ms) antes de relatar falha de conexão.
- **Preservação de Permissões POSIX e Resolução Dinâmica de Binários (`bin/`)**: Aplicação em runtime de permissões `0755` para `yt-dlp` e `ffmpeg` em `extraResources` e propagação do diretório exato de binários via variável de ambiente `PATH` do subprocesso filho, garantindo interoperabilidade total com o sistema hospedeiro.
- **Desobstrução do Link "Ver todos" em Relação ao Disco de Vinil**: Elevação de camada (`z-index: 10` e `z-index: 11`) no cabeçalho de downloads recentes (`.rh` e `.rh a`) eliminando a sobreposição física e interceptação de eventos de ponteiro causadas pela área dimensional do disco decorativo (`.disc`).
- **Encerramento sem Zumbis (Graceful Shutdown)**: Captura rigorosa dos eventos `before-quit`, `will-quit` e `forceTeardown` para terminação atômica e coordenada do subprocesso Python via `SIGTERM` seguido de `SIGKILL`.
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
