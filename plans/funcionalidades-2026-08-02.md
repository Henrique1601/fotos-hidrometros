# Plano — Funcionalidades Fotos Hidrômetros (2026-08-02)

Origem: pedido do usuário em sessão. Repo `Henrique1601/fotos-hidrometros` (público, deploy Vercel automático).

## Escopo

1. Proteção de dados: backup/restore local + sync Supabase (e-mail+senha).
2. Luz (torch) e zoom (pinch) na câmera.
3. Rascunho automático de índice (sair da tela não perde) + validação de índices (média/desvio).
4. ZIP organizado, resumo por torre no Export, compartilhar campanha (Web Share).
5. CI GitHub Actions + Vitest (unit) + Playwright (E2E).

## Decisões

- `.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_TEST_USER/PASS`. Sync degrada graciosamente sem credenciais (botão desabilitado com aviso).
- Schema Dexie v1 mantém; `updatedAt` adicionado como campo (sem bump — sem índice novo). LWW no sync por `updatedAt`.
- Validação de índice: função pura em `src/lib/validate.ts`; avisos, não bloqueia.
- Backup: JSON único `{version, exportedAt, campaigns, records}` com fotos base64; restore substitui tudo (confirmação).
- Compartilhar: `navigator.share` com os arquivos gerados; fallback = download.
- CI: job 1 = vitest + build; job 2 = Playwright E2E contra dev server.

## Ordem de execução (dependências)

1. Vitest + CI + unit tests (towers/utils) — base.
2. Câmera: torch + zoom (lib + overlay) + testes.
3. Validação + rascunho (lib + Indices) + testes.
4. Backup/restore (lib + UI) + testes.
5. Export: ZIP nomes, resumo torre índices, compartilhar.
6. Sync Supabase (schema SQL, lib, UI auth).
7. Playwright E2E novos + build + run completo.
8. Docs (README, changelog, AGENTS) + commit/push.

## Invariantes

- `npm run build` (tsc + vite) verde após cada bloco.
- `npm run test` verde.
- E2E Playwright verde (headless, câmera fake).
- Sem comentários de código desnecessários; mobile-first.
