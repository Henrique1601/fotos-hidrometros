# 07 - Changelog

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
