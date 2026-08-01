# 06 - Deploy

## Plataforma

- **Vercel** (HTTPS automático), projeto estático `vite build`.
- Conta CLI autenticada como `henrique1601` (team `henrique1601s-projects`).

## Como fazer

Sempre usar a skill `deploy-to-vercel` (instruções completas lá). Resumo:

1. `git remote get-url origin` / `.vercel/project.json` para checar estado de link.
2. `vercel whoami` e `vercel teams list --format json`.
3. Projeto já linked → `vercel deploy -y --no-wait` (ou git push se houver remote).
4. Projeto não linked → `vercel link` (ou `--repo` se houver remote) e depois deploy.

## Comandos do projeto

- `npm run dev` — dev server local.
- `npm run build` — typecheck (`tsc -b`) + build Vite (o que a Vercel executa).
- `npm run preview` — serve o build localmente (`--host` para testar no celular da rede).
- `npm run icons` — regenera ícones PWA.

## PWA

- `registerType: 'prompt'` — usuário vê banner "atualização disponível" e recarrega manualmente.
- Precache do app shell + cache de assets via Workbox.
- Instalável no Chrome Android (testar em HTTPS — a Vercel já entrega).

## Checklist pós-deploy

- [ ] Abrir o preview/produção em viewport mobile (~390px).
- [ ] Testar instalação do PWA.
- [ ] Testar fluxo completo: criar campanha → foto (câmera real) → índice → exportar.
- [ ] Testar offline (avião) depois de primeira carga.

Ver também: [[00 - Visão Geral]] · [[07 - Changelog]]
