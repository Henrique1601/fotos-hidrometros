# 07 - Changelog

## 2026-09-04 — Modo Foco na Foto, Lupa no Mouse (PC) e Alertas de Índice Inconsistente

### Feito

- **Modo Foco na Foto nos Índices** (`src/screens/Indices.tsx` + `src/styles.css`):
  - A foto passa a ocupar a área principal da tela (~65% a 70% de altura útil), eliminando a necessidade de tocar para ampliar a cada apartamento.
  - Cabeçalho limpo com seletor de torre integrado e botão de busca retrátil (`showSearch`), liberando espaço vertical máximo.
  - Painel inferior fixo e focado na digitação: campo de índice ampliado com foco automático, exibição compacta do índice do mês anterior e botões de navegação (`Voltar` e `Avançar`) com suporte a atalhos de teclado (`Enter`, `Alt+←`, `Alt+→`).
- **Lupa Dinâmica com Movimento do Mouse para PC (Hover Zoom Lens)** (`src/screens/Indices.tsx` + `src/styles.css`):
  - Ao passar o cursor do mouse sobre a foto no computador, a imagem aplica zoom suave de 2.3× centrado exatamente nas coordenadas do cursor (`transform-origin: x% y%`), permitindo ler os roletes numéricos sem clicar em nenhum modal.
  - O cursor do mouse exibe feedback visual (`zoom-in`) e badge indicativo "🔍 Lupa 2.3× ativa".
  - Mantido suporte a clique/toque para abrir lightbox em tela cheia caso necessário.
- **Alertas Inteligentes de Índice Que Não Condiz / Muito Alto** (`src/lib/validate.ts` + `validate.test.ts` + `src/screens/Indices.tsx` + `src/styles.css`):
  - Verificação em tempo real enquanto o usuário digita:
    - **Regressão**: alerta se o valor for menor que a medição do mês anterior.
    - **Consumo Excessivo**: alerta se o consumo mensal calculado ultrapassar 30 m³ ou 50 m³ (anomalia em hidrômetro residencial).
    - **Confusão de Litros**: alerta se o índice ultrapassar 50.000 m³, avisando que o leiturista pode ter incluído os números vermelhos (litros) por engano.
    - **Salto vs. Média da Torre**: alerta se o índice destoar da média dos outros apartamentos da mesma torre já preenchidos.
  - Exibição em banner chamativo de alto contraste (vermelho/âmbar com ícone de alerta) abaixo do campo de entrada.
  - Atualizado `save()` em `Indices.tsx` para validar contra o `prevIdx` real do mês anterior com limite `{ maxDiff: 30 }`.
- **Carga da Base Histórica de Julho/2026** (`src/data/july2026Records.json` + `src/lib/seedJuly2026.ts` + `DataScreen.tsx` + `public/backup-julho-2026.json`):
  - Inclusão dos 1.435 índices anteriores de Julho/2026 das Torres A–H fornecidos pelo cliente.
  - Botão de 1 clique na tela de Dados: *"Carregar Base de Julho/2026"*, inserindo no Dexie com status concluído sem apagar medições existentes.
  - Arquivo de backup exportado disponível para restauração direta (`backup-julho-2026.json`).
  - Confirmação de que o apartamento `236` da Torre E existe e tem leitura (`2408,72 m³`).

### Testes

- `npm run test`: **63/63** testes unitários aprovados (9 arquivos de teste).
- `npm run build`: build Vite e typecheck aprovados com sucesso.

---

## 2026-09-01 — Tempo de Medição & Produtividade, OCR em Segundo Plano e Mira Guia de Enquadramento

### Feito

- **Mira Guia de Enquadramento no Visor da Câmera** (`src/components/CameraOverlay.tsx` + `src/styles.css`):
  - Retângulo guia visual com cantos em ciano brilhante, linha central de mira e legendas indicativas para dígitos pretos (m³) e vermelhos (Litros).
  - Botão de alternância rápida `MIRA` nos controles da câmera com persistência no `localStorage`.
- **OCR em Segundo Plano (Background Batch OCR)** (`src/lib/bgOcr.ts` + `src/screens/Indices.tsx`):
  - Fila assíncrona gerenciada por singleton que processa automaticamente todas as fotos pendentes de leitura no banco Dexie sem travar a interface.
  - Barra de status na tela de Índices com botão "Ler todas" / "Pausar" e contagem em tempo real de fotos processadas e índices reconhecidos.
  - Feedback de cálculo de consumo instantâneo durante a digitação na tela de Índices com avisos de anomalia (regressão negativa ou consumo alto > 30 m³).
- **Tempo de Medição & Métricas de Produtividade** (`src/lib/measurementStats.ts` + `Home.tsx` + `Collect.tsx` + `Export.tsx`):
  - Cálculo de tempo ativo real (descontando pausas longas/almoço > 10 min), ritmo médio por apartamento (ex.: `14s/un`) e velocidade de leitura (ex.: `240 un/h`).
  - Exibição de tempo e ritmo nos cards da tela inicial (`Home.tsx`).
  - HUD de tempo da torre ativa no cabeçalho da tela de coleta (`Collect.tsx`).
  - Card dedicado de "Produtividade & Tempo" com resumo por torre na tela de exportação (`Export.tsx`).

### Testes

- `npm run test`: **61/61** testes unitários aprovados (9 arquivos de teste).
- `npm run test:e2e`: **3/3** testes E2E Playwright aprovados.
- `npm run build`: build Vite concluído com sucesso.

---

- **Download automático no Modo Burst** (`src/components/CameraOverlay.tsx`): o disparo rápido agora salva a foto com marca d'água diretamente na pasta de Downloads do dispositivo enquanto avança imediatamente para o próximo apartamento.
- **Persistência da câmera sem tela preta** (`src/components/CameraOverlay.tsx`): eliminado o fechamento prematuro do stream de vídeo na captura manual. A transição para o próximo apartamento mantém o hardware da câmera pronto e a lanterna ligada, com reinício automático garantido caso o stream precise ser reaberto.
- **Backup em streaming de baixo consumo de memória** (`src/lib/backup.ts` + `src/screens/DataScreen.tsx`):
  - Substituída a conversão byte-a-byte em JavaScript pelo `FileReader.readAsDataURL` nativo do navegador.
  - Substituído o `JSON.stringify` monolítico por geração de `Blob` em streaming paginado (lotes de 15 registros), evitando picos de consumo de RAM que travavam ou recarregavam navegadores em celulares antigos.
  - Adicionado indicador visual de progresso (`Gerando (X/Y)...`) no botão de Backup.
- **Gerenciamento de memória e cache de fotos** (`src/hooks/usePhotoUrl.ts` + `src/lib/camera.ts`):
  - Adicionado cache LRU com capacidade máxima de 40 URLs e revogação automática (`URL.revokeObjectURL`) das fotos antigas.
  - Liberação imediata da memória do canvas de captura de fotos.
  - Adicionado `touch-action: manipulation` para remover atraso de 300ms de toque em navegadores móveis mais antigos.

### Testes

- `npm run test`: **54/54** testes unitários aprovados.
- `npm run test:e2e`: **3/3** testes E2E Playwright aprovados.
- `npm run build`: build Vite concluído com sucesso.

---

- **Auditoria de código e correção de bugs**:
  - **Exportação de PDF** (`src/lib/exportPdf.ts`): corrigida sobreposição da tabela da Torre A em cima da capa escura ao adicionar quebra de página apropriada para cada torre com registros.
  - **Sincronização Supabase** (`src/lib/sync.ts`): adicionada checagem de `towerId` e preservação do `id` do Dexie ao fazer merge dos registros no `pullAll`, evitando duplicatas de apartamentos de mesmo número em torres diferentes.
  - **Transmissão de OCR na captura** (`src/screens/Collect.tsx`): corrigido callback `onSaved` no `<CameraOverlay>` que ignorava o valor lido pelo OCR no disparo normal.
  - **Visualização de fotos no Histórico** (`src/screens/HistoryScreen.tsx` + `src/styles.css`): thumbnails ajustadas para `object-fit: contain` em fundo escuro sem cortes indesejados; adicionado modal de ampliação (lightbox) ao tocar em qualquer foto do histórico.
  - **Prevenção de vazamento de memória com ObjectURLs** (`src/lib/watermark.ts`): envolvido em bloco `try/finally` para assegurar que `URL.revokeObjectURL` seja sempre chamado mesmo em caso de erro na manipulação do canvas.
  - **Reset do input file** (`src/components/CameraOverlay.tsx`): limpa `e.target.value = ''` ao selecionar arquivos para permitir re-seleção da mesma foto sem travar o evento `onChange`.
  - **Ajustes nos testes E2E do Playwright** (`e2e/app.spec.ts`): resolvido conflito de strict mode nos seletores com `{ exact: true }` e escopo do modal de restauração.

### Testes

- `npm run test`: **54/54** testes unitários aprovados (7 arquivos de teste).
- `npm run test:e2e`: **3/3** testes E2E Playwright aprovados.
- `npm run build`: typecheck (`tsc -b`) e build Vite de produção concluídos sem erros.

---

## 2026-08-02 — Consumo, marca d'água, export por torre e busca de apt

### Feito

- **Consumo vs. mês anterior** (`src/lib/consumption.ts` + `consumption.test.ts`): `selectPreviousCampaign` escolhe a campanha imediatamente anterior (cruzando ano — janeiro → dezembro anterior); `computeConsumption` calcula `consumo = atual - anterior` com status `ok`/`anomaly` (fora de `0..30 m³` ou regressão negativa)/`no-base` (sem campanha ou índice anterior); `loadConsumption` monta `Map<torre:apt, Consumo>`. 9 testes.
- **Marca d'água nas fotos** (`src/lib/watermark.ts`): `watermarkPhoto(blob, text)` redimensiona para `maxW=1280`, desenha barra `rgba(7,24,34,0.72)` com texto branco em JetBrains Mono (label `${aptCode} · dd/mm/aaaa HH:mm`), salva JPEG 0.85; usada no PDF e no ZIP quando a opção está ativa.
- **Export por torre + consumo** (`exportPdf/exportExcel/exportZip.ts`): opções `{ towerId?, watermark? }`; PDF com coluna "Consumo" e anomalias destacadas em vermelho/negrito via `didParseCell`; Excel com sheet "Consumo" nova (`Torre/Ap/Índice Anterior/Índice Atual/Consumo/Status`) e coluna Consumo no sheet Índices; ZIP filtra por torre. `Export.tsx` ganhou chips "Todas" + A–H e checkbox de marca d'água.
- **Busca/atalho por apt** (`Collect.tsx` + `Indices.tsx`): form `.apt-jump` com ícone de busca — no Collect pula para o andar e abre a câmera do apt; no Indices navega direto para o apt fotografado; aviso "Apt não encontrado nesta torre." quando não acha. Estilos `.apt-jump`/`.apt-jump-msg` em `styles.css`.
- **Deps atualizadas** (npm audit): `jspdf@^4.2.1`, `jspdf-autotable@^5.0.8`, `xlsx@0.20.3` (cdn SheetJS). Resta risco aceito: `vite ≤6.4.2` → `esbuild ≤0.24.2` (GHSA-67mh-4wv8-2f99, só dev server; `--force` quebraria com vite 8).
- **Fix autotable v5**: `doc.getLastAutoTable` não existe em runtime (é do `DocHandler`) → posicionamento das fotos usa `doc.lastAutoTable.finalY` (com narrowing TS); augmentação em `src/lib/jspdf-autotable.d.ts`.
- **Lighthouse** (dev server): a11y 90→**100**, SEO 82→**100**, Agentic 67→**100**; removido `user-scalable=no` do viewport, meta description, `h1→h3` corrigido para `h1→h2→h2` no Home, criados `public/robots.txt` e `public/llms.txt`. Best Practices 81 é só `is-on-https` (http do dev server; em produção é https).

### Testes

- `npm run test`: 39 testes verdes (6 arquivos — towers, utils, camera, validate, backup, consumption). `npm run build`: passa. `npm run test:e2e`: 3 verdes.
- Verificação manual: jump `258` no Collect abre Andar 25 + câmera; foto injetada salva e auto-avança para `257`; índice `1.234` preenchido no Indices e **preservado ao refotografar**; jump inválido mostra aviso; exports PDF (com marca d'água)/Excel/ZIP sem erros de console; filtro de torre "Exportando apenas a Torre A.".

### Pendências

- [ ] Sync Supabase: credenciais reais rejeitadas (`AUTH_FAIL invalid_credentials`) — conferir/criar usuário em `wfjbvrneeukfbghhmcqs` (Authentication → Users) antes de liberar o sync.
- [ ] Confirmar com o cliente se a Torre E tem o ap `236`.
- [ ] Testar câmera real (torch/zoom) em celular (Chrome Android, HTTPS) em https://fotos-hidrometros.vercel.app.
- [ ] Teste offline completo (PWA).

## 2026-08-02 — Rodada funcionalidades: backup, sync, torch/zoom, validação, export completo e CI

### Feito

- **Backup/Restore local** (`src/lib/backup.ts`): card "Seus dados" no Home com botões Backup (baixa JSON com campanhas + registros e fotos base64) e Restaurar (substitui tudo após `confirm()`).
- **Sync Supabase** (`src/lib/sync.ts` + `supabase/schema.sql`): login e-mail/senha, `pushAll` (upsert em lotes de 50, fotos em base64), `pullAll` (merge LWW por `updatedAt`), `syncAll` = push → pull → push se houve pull; RLS por `auth.uid()`; sem `.env.local` o app degrada com aviso e segue 100% local.
- **Câmera torch + zoom** (`camera.ts` + `CameraOverlay.tsx`): capabilities (`isTorchSupported`/`isZoomSupported`), `setTorch`/`setZoom`, botão de luz e controles de zoom (+/− e pinch).
- **Validação de índices + rascunho automático** (`validate.ts` + `Indices.tsx`): `validateIndex` (decimal pt-BR, outliers por desvio padrão com avisos `IV_NEGATIVE`/`IV_HIGH`/`IV_LOW`), input com aviso de inválido e dica de índice provável; validação não bloqueia (salva no blur se válido).
- **Export completo + Compartilhar** (`exportZip/exportPdf/exportExcel.ts` + `Export.tsx`): `build*` retornam `NamedBlob` reutilizados no botão Compartilhar (`navigator.share` com PDF+Excel, fallback download + toast); ZIP organizado `Torre {id}/Andar {pad}/ap_{aptCode}.jpg`; resumo por torre com fotos+índices vs. total e pills de status.
- **CI** (`.github/workflows/ci.yml`): job `test` (vitest + build) e job `e2e` (Playwright chromium em servidor dev).
- **Estrutura de testes:** Vitest (5 arquivos, 30 testes: towers, utils, camera, validate, backup) + Playwright (`e2e/app.spec.ts`, 3 testes: fluxo completo com auto-avanço e resumo no export, backup+restore, índice inválido).

### Testes

- `npm run test`: 30 testes verdes. `npm run build`: passa (tsc + vite). `npx playwright test`: 3 testes verdes (viewport 390×844).

### Correções pós-CI

- **Lockfile consistente no `npm ci`**: `vitest@4.1.10` exigia `vite ^6||^7||^8` → instalava `vite 8.2.0` aninhado com peer opcional `esbuild ^0.27||^0.28` que no Linux resolvia para `esbuild@0.28.1` (ausente no lock gerado no Windows). Downgrade para `vitest@^3.2.4` (compatível com vite 5) elimina o vite aninhado e o peer problemático.
- **Actions CI**: `actions/checkout@v4`/`actions/setup-node@v4` → `@v5` (fim do aviso de depreciação do Node 20; `upload-artifact@v4` segue, sem warning bloqueante).
- **Race na câmera (causa de E2E flaky)**: quando o `getUserMedia` falhava **depois** da foto já ter sido tirada via arquivo (fallback), o `catch` de `start()` reescrevia `phase` para `'error'` e destruía o preview/"Salvar e próximo". Fix: ref `photoTakenRef` impede `start()` (sucesso ou falha tardia) de sobrescrever o estado de preview; E2E subiu de 3m30s para 1m no CI e está estável.
- **E2E mais robusto**: timeout global 60s + `expect` 15s no `playwright.config.ts`.

### Pendências

- [ ] Confirmar com o cliente se a Torre E tem o ap `236`.
- [ ] Testar câmera real (torch/zoom) em celular (Chrome Android, HTTPS) em https://fotos-hidrometros.vercel.app.
- [ ] Teste offline completo (PWA).
- [ ] Testar sync com credenciais reais (`.env.local` + schema aplicado no Supabase).

## 2026-07-31 — Implementação v1.0.0

### Feito

- **Repo GitHub criado e conectado à Vercel** — `Henrique1601/fotos-hidrometros` (privado), push na `main` = deploy automático de produção.
- **Deploy Vercel concluído** — https://fotos-hidrometros.vercel.app (project `fotos-hidrometros`, target production, status Ready, HTTP 200).
- **Spec aprovada** em `docs/superpowers/specs/2026-07-31-foto-hidrometros-design.md` (ajuste: códigos de ap sem zero à esquerda).
- **Banco:** schema Dexie `fotos-hidrometros` v1 (tabelas `campaigns` e `records`), índice único `[campaignId + towerId + aptCode]`.
- **CRUD:** `records.ts` com `upsertRecord` que preserva o índice ao refotografar.
- **Telas:** Home, NewCampaign, Collect, Indices, Export.
- **Componentes:** CameraOverlay (getUserMedia + fallback de arquivo + auto-avanço), AptButton, ProgressRing, GlassCard, Background.
- **Navegação:** `App.tsx` com troca de telas GSAP, toast global e banner de atualização PWA (registerType `prompt`).
- **Exports:** `exportPdf` (jspdf + autotable, inclui fotos opcional), `exportExcel` (xlsx), `exportPhotosZip` (jszip + file-saver). Assinaturas recebem o objeto campanha.
- **Ícones PWA** gerados via `npm run icons`.
- **Build:** `npm run build` passa (tsc + vite).

### Correções

- `exportPdf.ts`: `forEach` com `await` dentro → trocado por `for...of`.
- `Export.tsx`: corrigido nome `exportPhotosZip` e assinaturas (`exportPdf(campaign, includePhotos)`, `exportExcel(campaign)`).
- `Indices.tsx`: prop `toast` não usada removida; tipo de miniatura corrigido.
- **Bug de preview obsoleto** no auto-avanço da câmera: resolvido remontando `CameraOverlay` com `key={aptCode}`.

### Testes

- Fluxo completo validado em Chrome headless (playwright-core): criar campanha → coleta 0/180 → upload de foto → contador 1/180 → preencher índice com Enter → exportar XLSX/ZIP/PDF com zero erros JS.
- Overlay de câmera: após salvar `33`, abre `34` limpo (sem preview velho).

## 2026-07-31 — Ordem decrescente, botão voltar e overlay full-screen

### Feito

- **Coleta em ordem decrescente** dentro de cada andar: `columnSequence` em `towers.ts` agora inverte a ordem de unidades (`108 → 107 → ... → 101`), com auto-avanço por índice e grid em `Collect.tsx` exibido também decrescente.
- **Botão voltar** no topo do overlay da câmera (`Undo2`): retorna ao ap anterior da sequência; `handlePrev` + memo `camPrev` em `Collect.tsx`, prop `onPrev` em `CameraOverlay`.
- **Overlay da câmera full-screen**: era quebrado pelo `transform` que o GSAP deixa no `ScreenSwitch` (ancestral vira containing block do `position: fixed`). Corrigido renderizando o `CameraOverlay` via **portal** para `document.body`. Agora preview cobre a tela (390×685 em viewport 390×844) e `.cam-actions` fica abaixo da foto com fundo semi-opaco.

### Testes

- `test_order.py` (Playwright): grid em ordem decrescente, auto-avanço `108 → 107`, voltar `107 → 108`, registro `108:photo` persistido, zero erros JS.
- `check_layout.py`: preview full-bleed, botões abaixo da foto, sem sobreposição.
- `npm run build` passa.

### Pendências

- [ ] Confirmar com o cliente se a Torre E tem o ap `236`.
- [ ] Testar câmera real em celular (Chrome Android, HTTPS) em https://fotos-hidrometros.vercel.app.
- [ ] Teste offline completo (PWA).

## 2026-08-01 — Ordem por andar, Índices foto-primeiro, repo público e bug da tela preta

### Feito

- **Captura por andar inteiro** (item 1): `floorSequence(tower)` em `towers.ts` — andares ascendentes (03→25) e, dentro de cada andar, lado esquerdo descendente e depois direito descendente (`46→45→44→43→48→47→42→41`). `Collect.tsx` usa essa sequência no auto-avanço (`handleSaved`), no voltar (`handlePrev`/`camPrev`) e no grid.
- **Índices redesenhado** (item 2): `Indices.tsx` reescrito como viewer foto-primeiro — foto em destaque (objeto `iv-photo`), badge com código do apt, meta andar/lado, selo "Salvo", input de índice abaixo com Enter salvando e avançando, botões Voltar/Avançar e contador posição; chips de torre A–H; auto-posiciona no primeiro índice faltante. Novos estilos `.iv-*`/`.chip-*` em `styles.css`.
- **Repo público** (item 3): `Henrique1601/fotos-hidrometros` agora é **público** (`gh repo edit --visibility public`); criado `README.md` detalhado (fluxo, layout do condomínio, stack, exports, privacidade) e seção "Skills disponíveis" no `AGENTS.md`.
- **Bug tela preta ao refazer** (item 4): `CameraOverlay` agora mantém o `<video>` sempre montado; `beginCamera` renomeado para `start` (lança erro em vez de `return` silencioso); `handleRetake` chama `start()` novamente e volta para `live`.

### Testes

- `test_flow.py` (Playwright, câmera fake via `canvas.captureStream`): grid do andar 04 em ordem, refazer volta ao vivo sem tela preta, auto-avanço `46→45→44→43→48→47→42→41→56` cruzando para o andar 05, chip ativo `05`, 8 registros com foto, Índices abrindo no primeiro faltante (46), layout foto > painel, Enter salva e avança, voltar/avançar, índice `1234` persistido e exibido formatado (`1.234`), zero erros JS.
- `npm run build` passa (tsc + vite).

### Pendências

- [ ] Confirmar com o cliente se a Torre E tem o ap `236`.
- [ ] Testar câmera real em celular (Chrome Android, HTTPS) em https://fotos-hidrometros.vercel.app.
- [ ] Teste offline completo (PWA).

Ver também: [[00 - Visão Geral]] · [[06 - Deploy]]
