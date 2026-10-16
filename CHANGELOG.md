# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

## [2.6.0] - 2026-10-16

### Esteira de Empacotamento Standalone AppImage, Otimização de Cold Start e Estabilização de Janela em Produção
- **Esteira de Empacotamento Standalone Portátil (Linux AppImage)**:
  - Configuração do `electron-builder` (`package.json` e `electron-builder.yml`) com arquitetura `x64`, alvo `AppImage`, consolidação de scripts em `asar: true` e compressão balanceada `compression: "normal"`, priorizando velocidade de montagem FUSE.
  - Isolamento estático dos binários executáveis (`yt-dlp` e `ffmpeg`) via `asarUnpack: ["**/bin/*"]` e `extraResources`, prevenindo falhas de execução a partir do contêiner virtual ASAR no Linux.
  - Implementação do contrato canônico `getExecutableBinaryPath(binaryName: 'yt-dlp' | 'ffmpeg')` em `src/main/downloader/core.js` e `frontend/main/downloader/core.js`, com resolução resiliente em `process.resourcesPath`, diretório `bin/` local e caminhos de sistema com permissões defensivas `chmod 0755`.
- **Otimização Crítica do Tempo de Inicialização (Cold Start / Warm Boot)**:
  - Implementação do contrato `bootstrapOptimizedWindow(): Promise<BrowserWindow>` com estratégia Zero-Wait: pré-alocação imediata com `show: false` e tom escuro nativo `#081017`, eliminando telas brancas e cintilações.
  - Supressão de I/O bloqueante antes do primeiro frame e diferimento de verificações secundárias para microtasks disparadas estritamente após a emissão de `ready-to-show` e `win.show()`.
  - Controle de instância única via `app.requestSingleInstanceLock()`, restaurando a janela ativa e trazendo-a para o primeiro plano caso uma segunda invocação seja tentada.
- **Estabilização Definitiva dos Controles de Janela em Runtime Empacotado**:
  - Minimização assíncrona desacoplada de promises e validada com `!win.isDestroyed()`.
  - Fechamento atômico não-bloqueante (`forceTeardown`) com interrupção forçada (`SIGKILL`) de subprocessos em execução, desconexão total de listeners e encerramento com `win.destroy()` seguido de `app.exit(0)`.

## [2.5.5] - 2026-10-15

### Consolidação Atômica em Arquivo Único, Purga de Miniaturas Órfãs e Restauração da Colagem Nativa
- **Entrega de Mídia em Arquivo Único e Eliminação de Artefatos Órfãos**:
  - Imposição de remux/extração atômica em modos de áudio (incluindo "Áudio Original") através das diretivas `-x` (`--extract-audio`), `--audio-format best` (ou formato selecionado) e `--no-keep-video`. O fluxo Opus original em contêiner WebM é remuxado de forma bit-perfect (`acodec=copy`) para o contêiner legítimo `.opus`.
  - Embutição definitiva de metadados e imagem de capa em alta definição diretamente no contêiner de áudio consolidado via `--embed-thumbnail` e `--add-metadata`, eliminando o uso de `--write-thumbnail` e impedindo a dispersão de capas avulsas (`.webp`, `.png`) na pasta do usuário.
  - Implementação da rotina de purga pós-processamento `purgeOrphanThumbnails` (em `src/main/downloader/post-processor.js`, `core.js`, `backend/core/ytdlp_wrapper.py` e `backend/downloader.py`), varrendo o diretório e expurgando arquivos homônimos `.webp`, `.png`, `.jpg`, `.temp` ou contêineres intermediários `.webm`.
  - Implementação e exportação dos contratos `buildSingleFileAudioArgs(payload)` e `build_single_file_audio_args(...)` nas esteiras Node.js e Python.
- **Restauração e Blindagem do Botão de Colagem ("Colar")**:
  - Padronização do handler IPC para a API nativa da área de transferência (`electron.clipboard.readText()`) através de `registerClipboardHandlers(ipcMain)` e métodos consistentes no Preload (`readClipboard`, `readClipboardText`, `clipboard.readText`).
  - Vinculação delegada e duradoura de eventos de clique em nível de documento (`document.addEventListener('click', ...)` para `#btn-paste`), garantindo resposta tátil imediata imune a re-renderizações dinâmicas da barra de pesquisa.
  - Higienização com `.trim()`, encerramento silencioso e limpo para conteúdo vazio ou em branco sem poluir o input, despacho do evento nativo `input` (`new Event('input', { bubbles: true })`), foco no input e disparo imediato de inspeção para URLs com protocolo `http://` ou `https://`.

## [2.5.4] - 2026-10-15

### Correção de Stacking Context da Busca, Erradicação do Erro HTTP 416 e Restauração do Modal de Diagnóstico
- **Reestruturação Definitiva dos Contextos de Empilhamento (Z-Index)**:
  - Isolamento de camadas: `.search` com `position: relative; z-index: 30;` e `.hero` com `position: relative; z-index: 25;`, posicionando o campo de busca e seus botões ("Colar" e "Buscar") inequivocamente à frente do contorno do disco de vinil.
  - O contêiner `.disc` recebeu `position: absolute; z-index: 5 !important;`, e pseudo-elementos `.disc:after` e `.vinyl:after` foram blindados com `pointer-events: none !important;`.
  - Salvaguarda de colisão em `VinylDisc.js` para ceder o foco integralmente à barra de pesquisa em qualquer clique ou ponteiro sobre o formulário.
- **Erradicação do Erro Fatal de Download (HTTP Error 416: Requested range not satisfiable)**:
  - Implementação de `purgePartialDownloadArtifacts` (em `core.js` e `ytdlp_wrapper.py`) para purga defensiva de resíduos `.part`, `.ytdl` e `.temp` antes de cada execução e retentativa de tarefa.
  - Injeção obrigatória da flag `--no-continue` no construtor de argumentos do yt-dlp (`buildYtDlpDownloadArgs` e `build_download_command`), bloqueando requisições de continuação rejeitadas pelos servidores de streaming.
  - Ativação de `--concurrent-fragments 1` e `--no-part`, forçando download sequencial limpo e atômico a partir do byte zero.
- **Restauração e Delegação de Eventos do Botão Informacional de Erro ([i])**:
  - Implementação do componente `RecentDownloads.js` com ouvinte de clique delegado duradouro no contêiner permanente da lista (`#recent-downloads-list`), interceptando `.btn-error-info`, `.btn-retry-task` e `.btn-cancel-task` via `event.target.closest()`.
  - Criação do `task-store.js` em memória com contratos canônicos `registerDownloadFailure` e `retrieveDownloadFailure` mapeados por `taskId`.
  - Atualização do `ErrorModal.js` para cumprir o contrato `openErrorModal(details)` / `closeErrorModal()`, suportando classes de visibilidade `.is-active`, `.active`, `.open` com `aria-hidden="false"`, botão de cópia de logs para o clipboard e botão de fechar acessível (`#modal-close-btn`).

## [2.5.3] - 2026-10-15

### Correção de Crash de Miniatura, Diagnóstico e Retentativa, Vinil Interativo e Estabilidade de Janela
- **Saneamento Fatal de Pós-Processamento de Miniatura (yt-dlp/Mutagen)**:
  - Criação da lista canônica `SUPPORTED_THUMBNAIL_CONTAINERS` (`mp3`, `mkv`, `mka`, `ogg`, `opus`, `flac`, `m4a`, `mp4`, `m4v`, `mov`) e verificação condicional em `can_embed_thumbnail(container_format)`.
  - Supressão automática da flag `--embed-thumbnail` em streams brutos/WebM ou downloads no formato "Original", aplicando alternativamente `--write-thumbnail` para preservar a capa sem provocar exceções fatais do Mutagen.
- **Subsistema de Diagnóstico de Erros e Retentativa Imediata**:
  - Implementação de `ErrorModal` (`src/renderer/components/ErrorModal.js` e `frontend/components/ErrorModal.js`) com explicação acessível da falha, sugestão de ação corretiva e gaveta expansível de logs brutos com botão de cópia.
  - Indicador visual rubro `.st.err` com botão de diagnóstico informacional `[i]` e ação direta "Tentar novamente" (`.btn-retry-task`).
  - Handlers IPC (`download:retryTask`, `download:getErrorDetails`) e endpoints no backend (`POST /api/download/retry`, `GET /api/download/error-details`) que resetam o estado da tarefa em Recentes sem duplicar registros no Histórico.
- **Desbloqueio Irrestrito e Cinemática do Disco de Vinil**:
  - Desativação explícita de captura de eventos de ponteiro no pseudo-elemento overlay `.disc:after` (`pointer-events: none !important;`) e elevação da camada do componente `.disc` (`z-index: 10 !important;`).
  - Cinemática polar suave via `setPointerCapture`, cálculo estático do centro no pointerdown, rastreamento contínuo de rotação e retomada do giro automático sem saltos angulares.
- **Estabilidade do Ciclo de Vida da Janela Frameless no Linux**:
  - Prevenção do crash após minimizar com flags Chromium (`disable-renderer-backgrounding`, `disable-backgrounding-occluded-windows`).
  - Término limpo e imediato sem congelamento através da rotina `forceTeardown`, enviando `SIGKILL` a subprocessos pendentes de `yt-dlp` e `ffmpeg`, desvinculando listeners de `close`, destruindo a janela nativa e finalizando a aplicação com `app.exit(0)`.

## [2.5.2] - 2026-10-15

### Saneamento de Identidade no Header, Vinil Polar Contínuo e Skeleton Shimmer Aprimorado
- **Erradicação da Duplicação de Marca no Cabeçalho**:
  - Remoção completa de `.brand` / `.mark` e do título "Vitrola" da barra de título superior (`.top`), convertendo a faixa em área pura de arraste e controles de janela alinhados à direita.
  - Centralização exclusiva da identidade visual na barra lateral (`.side .logo`).
- **Ativação da Leitura de Área de Transferência (Clipboard IPC)**:
  - Registro de canais duplos (`clipboard:read-text` e `clipboard:readText`) em `main.js` e métodos no preload (`readClipboardText`, `clipboard.readText`).
  - Disparo programático de evento nativo `input` (`new Event('input', { bubbles: true })`) no campo de busca e disparo imediato de inspeção para URLs válidas (`http://` ou `https://`).
- **Física Polar e Retomada Contínua do Vinil Interativo (`VinylDisc.js`)**:
  - Implementação do contrato `VinylTracker` com rastreamento polar `Math.atan2(dy, dx) * (180 / Math.PI)` e retenção de ponteiro com `setPointerCapture`.
  - Retomada contínua de rotação automática a partir do ângulo exato de liberação via CSS custom property `--current-angle`, eliminando qualquer salto angular (angle jump).
- **Skeleton Screen Neutro e Saneamento da Capa (`.sleeve`)**:
  - Remoção definitiva do gradiente decorativo sunset (laranja/rosa) da `.sleeve`, aplicando base neutra sólida `var(--s2)`.
  - Gradiente de varredura luminoso contínuo com `@keyframes shimmer` (1.5s ease-in-out) em três barras proporcionais sem texto legível ou mockups fictícios.

## [2.5.1] - 2026-10-15

### Vinil Interativo, Leitura de Clipboard por IPC, Modo Original e Skeleton Shimmer
- **Controle Tátil e Arraste Angular do Disco de Vinil (`VinylDisc.js`)**:
  - Implementação de máquina de estados (`idle-spinning` / `user-dragging`) com paralisação da animação contínua e controle rotacional manual.
  - Algoritmo polar trigonométrico baseado em `Math.atan2(clientY - centerY, clientX - centerX)` com acumulador contínuo de graus e normalização contra saltos de transição de quadrantes.
  - Captura contínua de ponteiro via `element.setPointerCapture()` assegurando retenção de eventos mesmo com o cursor fora dos limites da janela.
  - Cursores ergonômicos `grab` em repouso e `grabbing` durante o arraste ativo.
- **Restauração do Fluxo de Colagem da Área de Transferência**:
  - Criação do manipulador IPC `src/main/ipc/clipboard-handler.js` consumindo `electron.clipboard.readText()`, imune a restrições de permissão do navegador.
  - Exposição segura na ponte `window.electronAPI.readClipboard()`.
  - Rota de contingência `GET /api/clipboard` no backend Python utilizando `wl-paste` e `xclip`.
  - Tratamento inteligente no `ui-controller.js`: se o conteúdo for URL válida, preenche e dispara a busca imediatamente; caso contrário, cola no input permitindo edição.
- **Modo "Original / Direto da Fonte" (Bypass de Conversão)**:
  - Adição da opção prioritária "Original (Sem conversão)" nos grupos de formatos de áudio e vídeo.
  - Desativação automática dos chips de compressão arbitrária (bitrates/resoluções) quando "Original" está selecionado.
  - Estimativa de tamanho real baseada em `filesize` ou `filesize_approx` brutos fornecidos pelo yt-dlp.
  - Bypass completo de pipes de FFmpeg (`-x`, `--audio-format`, `--recode-video`), despachando estritamente `-f bestaudio/best` (áudio) ou `-f bestvideo+bestaudio/best` (vídeo).
- **Redesenho do Skeleton Screen Neutro com Efeito Shimmer**:
  - Erradicação de imagens fictícias coloridas e textos estáticos prévios ("Título da Mídia", "Canal / Artista", "Web", "--:--").
  - Placeholder monocromático neutro (`var(--s2)`) com máscara de gradiente linear deslizante horizontal (`@keyframes shimmer` de 0% a 200%).
  - Barras esqueléticas (`.sk-bar`) com larguras proporcionais (70% para título, 42% para metadados).
  - Transição suave via fade-in (`fadeIn`) na revelação dos metadados reais, eliminando layout shift.
- **Saneamento do Layout no Estado Vazio de Downloads Recentes**:
  - Correção das regras CSS de `.list .empty-row` e `.row.empty-row` com `grid-column: 1 / -1`, `width: 100%` e `white-space: normal`.
  - Eliminação definitiva da quebra de linha vertical palavra por palavra, restabelecendo leitura corrida e espaçamento ergonômico.

## [2.5.0] - 2026-10-15

### Reformulação Visual Vinil, Telemetria de Armazenamento e Ergonomia da Interface
- **Paradigma Visual Vinil / Sonora de Alta Fidelidade**:
  - Nova topologia de janela em 3 faixas estruturais (`grid-template-rows: 40px 1fr 32px`): Barra de título nativa integrada de 40px, corpo de aplicação com grid de 208px e 1fr, e barra de status inferior de 32px.
  - Arte decorativa de disco de vinil giratório (`.disc .vinyl`) com animação contínua `@keyframes spin` e suspensão sob preferência de acessibilidade `prefers-reduced-motion`.
  - Mockup estilizado de disco saindo da capa (`.result .art` com `.sleeve` e `.rec`) para pré-visualização de mídia com badge de duração embutido.
  - Barra de pesquisa em pílula flutuante (`.search`) com indicador de atalho de teclado `<kbd>Ctrl V</kbd>`, botão de colar transparente e botão de busca com cor de destaque.
- **Telemetria de Disco e Armazenamento no Rodapé da Barra Lateral**:
  - Widget `.disk` com contagem automática em tempo real de faixas de áudio locais, vídeos e tamanho total ocupado (ex.: `12,4 GB` / `850 MB`).
  - Barra de medição horizontal (`.meter i`) refletindo o percentual de ocupação do diretório de destino.
  - Novos endpoints de telemetria `storage:getDirectoryTelemetry` no IPC do Electron e `POST /api/storage/telemetry` na API do backend Python.
- **Centralização da Gestão de Destino nos Ajustes**:
  - Realocação do controle e diálogo de alteração de pasta de download para a seção dedicada "Armazenamento e Destino" no modal de Ajustes.
  - Exibição de indicador passivo de destino ("Salvando em: ...") no card de resultado.
  - Botões para "Alterar Pasta de Destino" via diálogo nativo do sistema e "Abrir no Gerenciador de Arquivos".
- **Saneamento e Bloqueio de Formatos Fictícios**:
  - Remoção rigorosa e completa do formato FLAC inexistente em plataformas de streaming web.
  - Formatos de áudio suportados padronizados: MP3, Opus e M4A.
  - Formatos de vídeo suportados padronizados: MP4, WebM e MKV.
- **Barra Inferior de Status do Motor e Versão**:
  - Rodapé fixo de 32px (`.foot`) com telemetria visual de prontidão do yt-dlp e FFmpeg (`#status-engine`) e versão do aplicativo (`#status-version`).

## [2.4.0] - 2026-10-15

### Estabilização do Ciclo de Vida da Janela e Tingimento Tonal Global de Superfícies
- **Mitigação de Crash Pós-Minimização no Linux (Chromium GPU Suspension)**:
  - Injeção das flags de inicialização do Electron `disable-renderer-backgrounding` e `disable-backgrounding-occluded-windows`, impedindo descarte agressivo de contexto gráfico pelo compositor.
  - Invocação assíncrona não bloqueante de minimização via `windowController.minimizeWindow(win)`.
  - Notificação de estado de minimização para o WebContents (`window:minimized-state`) e aplicação do atributo `data-minimized="true"` no DOM raiz, pausando imediatamente transições e animações no CSS (`animation-play-state: paused !important; transition: none !important;`) e blindando o processo contra SIGSEGV.
- **Saneamento e Destravamento do Pipeline de Fechamento**:
  - Implementação de encerramento gracioso desacoplado em `windowController.terminateAppGracefully(win)`.
  - Disparo imediato de interrupção não bloqueante (`SIGTERM`) sobre subprocessos ativos de download (yt-dlp e FFmpeg) registrados no `activeProcessesPool`.
  - Remoção atômica de listeners concorrentes de IPC e da janela, seguida de destruição imediata da janela (`win.destroy()`) e encerramento da aplicação (`app.quit()`) em menos de 300ms, eliminando qualquer risco de travamento ou deadlock.
- **Sistema de Tingimento Tonal Global de Superfícies por Cor-Tema**:
  - Adoção das 5 matrizes cromáticas padrão (**Âmbar**, **Violeta**, **Esmeralda**, **Carmim** e **Ciano**) com seus respectivos subtons de superfície, exportadas em `THEME_PALETTES`.
  - **Modo Escuro Neutro (Padrão)**: Superfícies tingidas com viés tonal perceptível (8% a 14% de saturação) na matiz ativa (`--win` ~10%, `--surface` ~13%, `--raised` ~18% e `--line` translúcido).
  - **Modo Escuro AMOLED**: Preservação estrita e rigorosa do preto puro `#000000` em `--win`, `--desk` e `--side`, restringindo o tingimento a bordas (`--line`), elevações sutis (`--raised`), badges e sombras de destaque.
  - **Modo Claro**: Fundos claros tingidos suavemente na matiz ativa (`--win` ~97%, `--surface` ~93%, `--raised` ~88%, `--text` escuro com viés tonal profundo ~12%).
  - **Identidade de Marca Dinâmica**: Sincronização das barras de onda verticais da logo `.mark` (`--brand-mark-primary` e `--brand-mark-secondary`) e tipografia `vitrola` na titlebar (`.brand-title` com `--brand-title-color`).
  - **Harmonização de Componentes**: Bordas de foco de pesquisa (`.linkbar:focus-within`), chips de formato/qualidade ativos e hover, botão de ação "Baixar" e ondas de áudio ativas.
  - **Reatividade e Ausência de FOUC**: Injeção e leitura antecipada de `data-accent-color` e `data-theme-color` no bootstrap de `<head>` antes do primeiro paint e eliminação de layout shifts.

## [2.3.2] - 2026-10-15

### Correção de Falha de Inicialização (Crash on Boot) e Estabilização do Electron
- **Interceptação Defensiva de Exceções Globais**:
  - Acoplamento de listeners para `uncaughtException` e `unhandledRejection` no topo absoluto do processo principal (`src/main/main.js`).
  - Implementação do registrador defensivo `logStartupDiagnostic(stage, errorDetails)` com emissão em terminal e persistência em `_dev/diagnostics/boot.log`.
- **Implementação do Preload Script Seguro (`src/main/preload.js`)**:
  - Criação do script preload com `contextIsolation: true` e `nodeIntegration: false`, expondo a ponte `electronAPI` via `contextBridge` para controles de janela, diretórios, metadados e histórico.
- **Saneamento de Caminhos e Resolução de Assets**:
  - Conversão dos links de stylesheets (`theme.css`, `main.css`, `window.css`) e scripts (`ui-controller.js`) em `src/renderer/index.html` de caminhos absolutos com barra inicial para notação relativa (`./`), erradicando falhas `ERR_FILE_NOT_FOUND` sob protocolo nativo `file://`.
- **Mitigação de Falhas Gráficas e Compositores Linux**:
  - Injeção preventiva de flags do Chromium (`--ozone-platform-hint=auto`, `--disable-gpu-sandbox`, `WaylandWindowDecorations`) e contingência condicional para desativação de aceleração gráfica por hardware.
- **Sequenciamento de Exibição da Janela**:
  - Adoção de inicialização com `show: false` e preenchimento sólido `#181A21`, exibindo a janela somente após o evento `ready-to-show` e prevenindo flashes brancos.
  - Implementação de listeners para `did-fail-load`, `render-process-gone` e `crashed` com fallback para template HTML de contingência.

## [2.3.1] - 2026-10-15

### Estabilização de Janela Frameless e Aprimoramento do Histórico
- **Estabilização de Arraste e Controles de Janela**:
  - Correção do arraste da barra de título no ambiente Linux (X11/Wayland) via filtro global de eventos `TitlebarDragFilter` no QtWebEngine/PySide6 utilizando `startSystemMove()`.
  - Habilitação de área arrastável contínua em `.titlebar` e `.brand` em `window.css`, mantendo controles interativos com `-webkit-app-region: no-drag`.
  - Suporte a duplo clique na barra de título para alternar maximização e mousedown nativo.
  - Eliminação de botões gráficos inertes (`.tb-menu`, `.tb-sep`) na barra de título.
  - Encerramento limpo e seguro de subprocessos ativos yt-dlp e FFmpeg (`cancel_all_active_tasks()`) na ação de fechar janela, prevenindo zumbis, deadlocks e crashes.
- **Agrupamento e Contagem Cumulativa no Histórico**:
  - Consolidação do algoritmo de deduplicação e agrupamento por `mediaKey` (`${title}_${format}`), condensando downloads repetidos em um único cartão com badge multiplicador (ex.: `4x`).
  - Erradicação absoluta de strings literais corrompidas e ambíguas (`"NA"`, `"N/A"`, `null`, `undefined`) em metadados, tamanhos e arquivos no frontend e backend (`sanitizeMetadataString`, `format_size_bytes`).
  - Implementação de botão de exclusão granular (`.btn-delete-history-item` com ícone de lixeira `#i-trash`) por registro no modal de histórico.
  - Implementação de expurgo total de histórico (`#btn-clear-history`) com diálogo de confirmação do usuário e contador em tempo real (`#history-total-count`).
- **Harmonização Estética de Barras de Rolagem (Scrollbar)**:
  - Padronização de scrollbar compacta (6px) com trilho transparente e thumb sensível ao tema (`--line-strong` e `--line-hover`), perfeitamente integrada aos modos Claro, Grafite (Slate) e AMOLED puro.

## [2.3.0] - 2026-10-15

### Rebranding Definitivo & Sincronização Canônica
- **Rebranding Integral para Vitrola (`vitrola`)**:
  - Consolidação formal e definitiva da identidade sob a marca **Vitrola** (slug: `vitrola`).
  - Redefinição do repositório canônico para [https://github.com/i9Yuri/Vitrola](https://github.com/i9Yuri/Vitrola).
  - Erradicação de nomenclaturas residuais anteriores nos manifestos, UI, backend e documentação oficial.
  - Reafirmação da segregação arquitetural estrita em relação ao tocador irmão JustPlay.
- **Contratos IPC e Metadados Globais**:
  - Implementação do manifesto oficial `package.json` com campos `repository`, `homepage` e `bugs`.
  - Formalização dos contratos IPC de metadados (`system:getAppMetadata`) e manipulação de destino (`storage:getDefaultDirectory`, `storage:openTargetDirectory`, `storage:updateTargetDirectory`).
  - Tipagem unificada de histórico `HistoryRecord` e constantes globais `APP_CONFIG`.
- **Persistência de Dados e Expurgos**:
  - Migração padronizada de chaves de `localStorage` para `vitrola_settings` e `vitrola_history`, com expurgo de chaves antigas.
  - Migração de arquivos de configuração para `~/.config/vitrola/` com fallback recursivo para `~/Música/Vitrola`.
- **Ambiente Operacional e Compilação**:
  - Títulos de janela, executável `dist/Vitrola` e lançadores de desktop `Testar-Vitrola.desktop` e `vitrola.desktop`.

## [2.2.0] - 2026-10-15

### Rebranding & Consolidação Arquitetural
- **Rebranding Formal para Maré (`mare`)**:
  - Consolidação oficial da identidade visual e arquitetural da aplicação sob o nome **Maré** (slug: `mare`), extinguindo todas as referências legadas a "MediaForge" e resíduos de "Fita".
  - Separação formal e estrita em relação ao tocador multimídia JustPlay.
  - Sincronização e rastreamento canônico ao repositório [https://github.com/i9Yuri/MediaForge](https://github.com/i9Yuri/MediaForge).
- **Manifestos e Metadados**:
  - Criação de `package.json` formalizado com metadados, scripts de build/dev/test e repositório.
  - Definição do módulo canônico de constantes globais `APP_METADATA` em `src/shared/constants.ts` e `src/shared/constants.js`.
- **Governança de Configurações e Histórico**:
  - Migração suave e transparente dos arquivos de configuração (`~/.config/mare/config.json`) e histórico (`~/.config/mare/history.json`), com leitura de fallback dos diretórios legados.
  - Atualização do diretório padrão sugerido para `~/Música/Maré` (com fallback seguro para `~/Downloads/Maré`).
  - Migração de estado local (`localStorage`) no frontend para `mare_config`.
- **Ambiente Desktop e Compilação**:
  - Atualização dos títulos de janela, classe de janela (`MareFramelessWindow`), nome da aplicação e logs do console.
  - Lançador nativo desktop `Testar-Mare.desktop` e atalho de aplicação `mare.desktop`.
  - Atualização do script de compilação PyInstaller (`build.sh`) gerando `dist/Mare` a partir de `Mare.spec`.

## [2.1.0] - 2026-10-15

### Corrigido (Fixed)
- **Eliminação da Janela Aninhada (Frameless Edge-to-Edge)**:
  - Remoção de margens e padding de 16px do `body` e conversão da janela interna `.window` para preenchimento total `100vw` e `100vh`.
  - Configuração de `Qt.FramelessWindowHint` no runner nativo desktop com suporte a arraste e redimensionamento nativos.
  - Vinculação dos botões de controle de janela (minimizar, maximizar/restaurar e fechar) a handlers nativos via `/api/window/action` e IPC.
- **Reestruturação da Sidebar**:
  - Exclusão do botão "Fila" redundante da barra lateral de navegação (o status da fila permanece no painel lateral direito fixo).
  - Transição e renomeação de "Biblioteca" para "Histórico".
- **Modal Contextual de Destino ("Salvando em")**:
  - Implementação de pop-up contextual flutuante (`#modal-dest`) ao clicar em "Salvando em", com ações dedicadas para "Abrir Pasta Atual" e "Alterar Pasta de Destino" via diálogo nativo do SO (`zenity` / `kdialog`).
- **Blindagem e Deduplicação do Histórico**:
  - Algoritmo de unicidade por chave de mídia (`mediaKey`) com contador cumulativo e badge multiplicador estilizado (ex.: `2x`).
  - Formatação defensiva de timestamps em pt-BR eliminando qualquer ocorrência de `Invalid Date`.
  - Verificação prévia de existência de arquivo no disco (`/api/check-file` / `fs.existsSync`) antes de acionar a revelação no gerenciador, com emissão de toast informativo caso o arquivo tenha sido movido ou excluído.
- **Saneamento da Paleta Violeta e Zero Layout Shift**:
  - Correção dos tokens de acento para a cor Violeta (`html[data-accent="violet"]` agora propaga devidamente `--accent: var(--accent-violet)` e preenche todas as superfícies dependentes).
  - Estabilização dimensional de botões com grid estático e preservação constante de `font-weight: 550` e bordas fixas, eliminando qualquer deslocamento de layout (layout shift) ao alternar temas ou cores.

## [2.0.0] - 2026-10-14

### Adicionado (Added)
- **Redesign Visual sob o Padrão "Fita"**:
  - Nova hierarquia espacial transposta fielmente do protótipo de alta fidelidade `fita-tela-inicial.html`.
  - Titlebar customizada com branding de barras de equalizador animadas, botão de menu e controles nativos de janela (minimizar, maximizar, fechar com transição `#D9484F`).
  - Shell bipartido em grid `208px 1fr` com sidebar de navegação, badge numérico dinâmico de fila e atalho com exibição de pasta de destino (`~/Downloads/MediaForge`).
  - Área central com barra de busca (`.linkbar`), suporte nativo ao botão Colar e atalho global de clipboard (`Ctrl+V`) para busca imediata a partir de qualquer ponto da janela.
  - Cartão de resultado Bento (`.card`) com visualizador 16:9, badges de duração tabular, metadados tipográficos e seletor primário (`role="radiogroup"`) entre Áudio e Vídeo.
  - Seletor em chips reativos para formatos (MP3, M4A, OPUS, FLAC / MP4, WEBM, MKV) e qualidades/resoluções (320 kbps, 256 kbps, 128 kbps / 1080p, 720p, 480p, 360p) com estimativa preditiva dinâmica de tamanho (`.size`).
  - Interruptores switches para embutimento de capas/metadados e legendas.
- **Visualizador de Progresso em Waveform**:
  - Renderização determinística de envelope de 44 barras verticais (`<i>`) indexadas pelo ID do download e função pseudo-aleatória senoidal.
  - Interpolação contínua de progresso via Server-Sent Events (SSE), ativando classes `.on` e pulso animado `.on.edge` no ponto de corte.
- **Motor de Temas e Superfícies Desacoplado**:
  - Suporte completo a **Modo Claro (Light)**, **Modo Escuro Padrão (Slate)** e **Modo Escuro AMOLED (Pure Black #000000)** com tokens semânticos CSS nativos.
  - Seletor de paletas de acento: Dinâmico (Âmbar para Áudio `#FFB547` e Violeta para Vídeo `#8E96FF`), Âmbar, Violeta, Esmeralda (`#10B981`), Carmim (`#F43F5E`) e Ciano (`#06B6D4`).
  - Persistência em `localStorage` sob a chave `user_theme_preferences` e script inline de bootstrap no `<head>` para eliminação de FOUC.
- **Painel de Governança do yt-dlp**:
  - Seção dedicada no modal de Ajustes com telemetria de versão em tempo real (dot verde operacional, âmbar para atualização, vermelho para erro).
  - Verificação assíncrona de novas versões e acionamento in-place de auto-update (`yt-dlp -U`) com visualizador de logs em buffer.
  - Diálogo nativo do SO (`zenity` / `kdialog`) para seleção de diretório de downloads.
- **Isolamento de Staging**:
  - Armazenamento do mockup original em `_dev/staging/fita-tela-inicial.html` e `_dev/reference/fita-tela-inicial.html`.

### Modificado (Changed)
- Modularização do frontend com separação em ESModules (`theme-manager.js`, `ytdlp-manager.js`, `ui-controller.js`) e folhas de estilo semânticas (`theme.css`, `main.css`).
- Estruturação completa em `src/renderer/` com compatibilidade bidirecional com a esteira `frontend/`.
- Backend Python atualizado com endpoint seguro `/api/select-folder` integrado aos diálogos nativos do Linux.
