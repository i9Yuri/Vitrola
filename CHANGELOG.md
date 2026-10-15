# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

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
