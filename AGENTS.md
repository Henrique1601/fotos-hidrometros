# AGENTS.md — Fotos Hidrômetros Web

## Regra obrigatória: use skills

SEMPRE consulte e use as skills carregadas e MCPs antes de qualquer tarefa — documentação (context7), busca de código (gh_grep), deploy (deploy-to-vercel), testes de UI (webapp-testing / playwright), design (.pen via pencil). Nunca execute trabalho guiado por skill "do jeito cru" sem carregar a skill primeiro.

**Caminhos das skills (varia por máquina):**
- PC pessoal (henri): `C:\Users\henri\.agents\skills`
- PC trabalho (conta): `C:\Users\conta\.agents\skills`

## Projeto

PWA mobile-first (React 18 + Vite 5 + TypeScript) para fotografia de hidrômetros por condomínio: coletar fotos das medições por torre/andar/unidade com avanço automático, preencher índices depois, e exportar relatório PDF, planilha Excel e ZIP das fotos.

- Package: `fotos-hidrometros` v1.0.0
- Spec aprovada: `docs/superpowers/specs/2026-07-31-foto-hidrometros-design.md`

## Comandos

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + build Vite
- `npm run preview` — serve build (flag `-- --host` p/ testar no celular da rede)
- `npm run test` — testes unitários (Vitest, `src/**/*.test.ts`)
- `npm run test:watch` — Vitest watch
- `npm run test:e2e` — testes E2E (Playwright, pasta `e2e/`, usa dev server)
- `npm run icons` — regenera ícones PWA (scripts/generate-icons.ps1)
- Deploy: use a skill `deploy-to-vercel` (CLI já autenticado como `henrique1601`)
- Git: repositório `Henrique1601/fotos-hidrometros` (público), conectado à Vercel → push na `main` dispara deploy automático de produção

## Stack

Dexie + dexie-react-hooks (IndexedDB local), GSAP + @gsap/react (animações), lucide-react (ícones), jspdf + jspdf-autotable (PDF), xlsx (Excel), jszip + file-saver (ZIP), @supabase/supabase-js (sync). PWA via vite-plugin-pwa, `registerType: 'prompt'` (banner de atualização com recarregar). Testes: Vitest (`src/**/*.test.ts`) + Playwright (`e2e/`), CI em `.github/workflows/ci.yml`.

## Arquitetura

- `src/nav.ts` — tipo `Screen` (home | new-campaign | collect | indices | export)
- `src/App.tsx` — troca de telas com transição GSAP, toast global, banner de atualização PWA
- `src/screens/` — Home (campanhas + progresso + deletar + backup/restore + login sync), NewCampaign (nome/mês/ano + grid de torres), Collect (fotos), Indices (leitura dos índices com validação), Export (resumo por torre + PDF/Excel/ZIP + compartilhar)
- `src/components/` — CameraOverlay (câmera + torch + zoom + fallback de arquivo + auto-avanço), AptButton, ProgressRing, GlassCard, Background
- `src/db/db.ts` — schema Dexie (`fotos-hidrometros`, v1), tabelas `campaigns` e `records` (ambas com `updatedAt`)
- `src/db/records.ts` — CRUD incluindo `upsertRecord` (preserva índice ao refotografar)
- `src/lib/` — `towers.ts` (config do condomínio), `utils.ts`, `camera.ts` (capabilities + torch/zoom), `validate.ts` (validação de índices), `backup.ts` (backup/restore JSON), `sync.ts` (push/pull Supabase), exportadores `exportPdf.ts` / `exportExcel.ts` / `exportZip.ts` (retornam `NamedBlob` via `build*`)
- `supabase/schema.sql` — schema remoto (tabelas `campaigns`/`records` com RLS por `auth.uid()`)
- `src/hooks/usePhotoUrl.ts` — Blob → ObjectURL com revogação
- `e2e/app.spec.ts` + `playwright.config.ts` — testes E2E (dev server, viewport 390×844)

## Regras de negócio (não alterar sem consultar a spec)

- 8 torres A–H: andares 03–25 nas torres A–G, e 03–24 na torre H (não possui 25º andar, total de 173 apts). Código do apt exibido SEM zero à esquerda (`31`, `101`, `258`); internamente `aptCode = String(andar * 10 + unidade)`.
- Andar 03: torres A/B/D/E/F = unidades 1–4 (apt 35 não existe na Torre E); torres C/G/H = unidades 1–5. Andares 04–25 (04–24 na Torre H) = unidades 1–8.
- Lado: unidade 3–6 → esquerda; 1/2/7/8 → direita.
- Confirmado com o cliente: o apt 236 da Torre E existe normalmente (leitura ativa). O apt 35 da Torre E não existe (Torre E possui 4 apts no andar 03: 31 a 34, totalizando 180 apts).
- Fluxo: criar campanha mensal → fotografar **por andar** (03→25; lado esquerdo descendente, depois direito descendente — ex.: `46→45→44→43→48→47→42→41`) com auto-avanço → preencher índices (foto em destaque, input abaixo, Enter salva e avança) → exportar.
- Ordem de captura e navegação vêm de `floorSequence(tower)` em `src/lib/towers.ts` (usada em Collect e Indices).

## Exports

Assinaturas recebem a campanha (objeto), NÃO `{campaignId}`:
- `exportPdf(campaign, includePhotos?)` → `${label}-relatorio.pdf`
- `exportExcel(campaign)` → `${label}-indices.xlsx`
- `exportPhotosZip(campaign)` → `${label}-fotos.zip`

Os `build*` (`buildPdf`/`buildExcel`/`buildPhotosZip`) retornam `NamedBlob` (`{blob, name}`) e são reutilizados no botão Compartilhar (`navigator.share` + fallback download).

## Sync & Backup

- Sync Supabase usa e-mail + senha (`src/lib/sync.ts`). Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (`.env.local`, já gitignored) o sync degrada com aviso — o app funciona 100% local com Backup/Restaurar.
- `pushAll` envia campanhas + fotos em base64 (lotes de 50); `pullAll` faz merge LWW por `updatedAt`; `syncAll` = push → pull → push se houve pull.
- Backup/Restore: `src/lib/backup.ts` — backup baixa JSON (campanhas + registros com fotos base64); restore substitui tudo com `confirm()`.
- Schema remoto em `supabase/schema.sql` (RLS por `auth.uid()`).

## Design

Paleta "visor de medidor": fundo oceano escuro `#071822`, ciano `#5eead4`, glassmorphism. Fontes: Unbounded (display), Outfit (texto), JetBrains Mono (códigos). Tema completo em `src/styles.css`.

## Cérebro do projeto (Obsidian)

Vault Obsidian em `Cerebro_Projeto/Hidrometros_Web/` (raiz do projeto). Manter as notas numeradas `NN - Nome.md` atualizadas (Visão Geral, Arquitetura, Estrutura, Banco, Deploy, Design, Changelog...). Sempre que este AGENTS.md mudar de forma relevante, refletir no cérebro.

## Skills disponíveis

Skills relevantes para este projeto (carregadas de `C:\Users\henri\.agents\skills` e MCPs). Carregue a skill **antes** de executar o trabalho guiado por ela:

- **deploy-to-vercel** — deploy na Vercel (CLI já autenticado como `henrique1601`).
- **webapp-testing / playwright** — testes de UI locais (interação, screenshots, console logs).
- **context7** (MCP) — documentação atual de libs/frameworks.
- **gh_grep** (MCP) — exemplos de código reais no GitHub.
- **pencil** (MCP) — edição/validação de designs `.pen`.
- **browser-qa / canary-watch** — verificação pós-deploy do site público.
- **lighthouse** — auditoria de performance/a11y/SEO do PWA.

## Convenções de código

- Não adicionar comentários ao código a menos que solicitado.
- Seguir padrões existentes (glass cards, hooks, exports).
- Manter foco mobile-first (testar em viewport ~390px).
