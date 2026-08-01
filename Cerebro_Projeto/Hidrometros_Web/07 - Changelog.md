# 07 - Changelog

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

### Pendências

- [ ] Confirmar com o cliente se a Torre E tem o ap `236`.
- [ ] Testar câmera real em celular (Chrome Android, HTTPS) em https://fotos-hidrometros.vercel.app.
- [ ] Teste offline completo (PWA).

Ver também: [[00 - Visão Geral]] · [[06 - Deploy]]
