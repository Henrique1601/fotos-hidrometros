# AGENTS.md — Fotos Hidrômetros Web

## Regra obrigatória: use skills

SEMPRE consulte e use as skills carregadas (`C:\Users\henri\.agents\skills`) e MCPs antes de qualquer tarefa — documentação (context7), busca de código (gh_grep), deploy (deploy-to-vercel), testes de UI (webapp-testing / playwright), design (.pen via pencil). Nunca execute trabalho guiado por skill "do jeito cru" sem carregar a skill primeiro.

## Projeto

PWA mobile-first (React 18 + Vite 5 + TypeScript) para fotografia de hidrômetros por condomínio: coletar fotos das medições por torre/andar/unidade com avanço automático, preencher índices depois, e exportar relatório PDF, planilha Excel e ZIP das fotos.

- Package: `fotos-hidrometros` v1.0.0
- Spec aprovada: `docs/superpowers/specs/2026-07-31-foto-hidrometros-design.md`

## Comandos

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + build Vite
- `npm run preview` — serve build (flag `-- --host` p/ testar no celular da rede)
- `npm run icons` — regenera ícones PWA (scripts/generate-icons.ps1)
- Deploy: use a skill `deploy-to-vercel` (CLI já autenticado como `henrique1601`)
- Git: repositório `Henrique1601/fotos-hidrometros` (público), conectado à Vercel → push na `main` dispara deploy automático de produção

## Stack

Dexie + dexie-react-hooks (IndexedDB local), GSAP + @gsap/react (animações), lucide-react (ícones), jspdf + jspdf-autotable (PDF), xlsx (Excel), jszip + file-saver (ZIP). PWA via vite-plugin-pwa, `registerType: 'prompt'` (banner de atualização com recarregar).

## Arquitetura

- `src/nav.ts` — tipo `Screen` (home | new-campaign | collect | indices | export)
- `src/App.tsx` — troca de telas com transição GSAP, toast global, banner de atualização PWA
- `src/screens/` — Home (campanhas + progresso + deletar), NewCampaign (nome/mês/ano + grid de torres), Collect (fotos), Indices (leitura dos índices), Export (PDF/Excel/ZIP)
- `src/components/` — CameraOverlay (câmera + fallback de arquivo + auto-avanço), AptButton, ProgressRing, GlassCard, Background
- `src/db/db.ts` — schema Dexie (`fotos-hidrometros`, v1), tabelas `campaigns` e `records`
- `src/db/records.ts` — CRUD incluindo `upsertRecord` (preserva índice ao refotografar)
- `src/lib/` — `towers.ts` (config do condomínio), `utils.ts`, `camera.ts`, exportadores `exportPdf.ts` / `exportExcel.ts` / `exportZip.ts`
- `src/hooks/usePhotoUrl.ts` — Blob → ObjectURL com revogação

## Regras de negócio (não alterar sem consultar a spec)

- 8 torres A–H, andares 03–25. Código do apt exibido SEM zero à esquerda (`31`, `101`, `258`); internamente `aptCode = String(andar * 10 + unidade)`.
- Andar 03: torres A/B/D/F = unidades 1–4; torres C/E/G/H = unidades 1–5. Andares 04–25 = unidades 1–8.
- Lado: unidade 3–6 → esquerda; 1/2/7/8 → direita.
- Pendência aberta: Torre E pode não ter o apt `236` — confirmar com o cliente.
- Fluxo: criar campanha mensal → fotografar **por andar** (03→25; lado esquerdo descendente, depois direito descendente — ex.: `46→45→44→43→48→47→42→41`) com auto-avanço → preencher índices (foto em destaque, input abaixo, Enter salva e avança) → exportar.
- Ordem de captura e navegação vêm de `floorSequence(tower)` em `src/lib/towers.ts` (usada em Collect e Indices).

## Exports

Assinaturas recebem a campanha (objeto), NÃO `{campaignId}`:
- `exportPdf(campaign, includePhotos?)` → `${label}-relatorio.pdf`
- `exportExcel(campaign)` → `${label}-indices.xlsx`
- `exportPhotosZip(campaign)` → `${label}-fotos.zip`

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
