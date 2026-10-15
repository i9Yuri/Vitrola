# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

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
