<div align="center">

# 💧 FotoHidro — Fotos de Hidrômetros

**PWA mobile-first para coleta de fotos e leitura de hidrômetros por condomínio.**

Capture fotos das medições torre a torre com **avanço automático**, preencha os índices depois, e exporte relatório **PDF**, planilha **Excel** e **ZIP** com todas as fotos — tudo **offline**, direto no navegador.

![React](https://img.shields.io/badge/React-18-5eead4?style=flat-square&logo=react&logoColor=white&color=0f766e)
![Vite](https://img.shields.io/badge/Vite-5-5eead4?style=flat-square&logo=vite&logoColor=white&color=0f766e)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-5eead4?style=flat-square&logo=typescript&logoColor=white&color=0f766e)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-5eead4?style=flat-square&logo=pwa&logoColor=white&color=0f766e)
![License](https://img.shields.io/badge/license-MIT-5eead4?style=flat-square)

![App](https://img.shields.io/badge/demo-fotos--hidrometros.vercel.app-5eead4?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## ✨ O que faz

Fluxo de trabalho pensado para quem faz a leitura dos hidrômetros **no campo**:

1. **Crie a medição mensal** — nome, mês e ano da campanha.
2. **Fotografe por andar** — a câmera abre com o código do apartamento na tela, o auto-avanço segue a ordem do prédio (lado esquerdo descendente, depois direito descendente) e você só vai capturando. Precisa repetir? O botão **Refazer** volta para a câmera na hora.
3. **Preencha os índices** — a foto fica em destaque na tela, o campo abaixo e Enter salva e avança. Validação amigável: avisos de índice suspeito (negativo ou muito alto/baixo) e rascunho automático do valor provável.
4. **Exporte** — relatório PDF (com ou sem fotos), planilha Excel dos índices, ZIP das fotos organizado por torre/andar — e **Compartilhe** tudo por e-mail/WhatsApp.
5. **Guarde** — backup/restauração local em JSON, ou **sincronize na nuvem** (Supabase) com e-mail e senha.

> 🕶️ **100% offline.** Dados e fotos ficam no IndexedDB do navegador (PWA). Nada sai do dispositivo até você exportar ou sincronizar.

## 🗼 Layout do condomínio

- **8 torres** (A–H) · **andares 03 a 25** · código do apt exibido sem zero à esquerda (`31`, `101`, `258`).
- Andar 03: torres A/B/D/F têm unidades 1–4; torres C/E/G/H têm unidades 1–5. Andares 04–25: unidades 1–8.
- **Lado**: unidades 3–6 → esquerda · 1/2/7/8 → direita.
- **Ordem de captura** (auto-avanço e navegação): por andar, esquerda descendente, depois direita descendente — ex.: `46 → 45 → 44 → 43 → 48 → 47 → 42 → 41`.

## 🚀 Começando

```bash
npm install        # instala as dependências
npm run dev        # dev server em http://localhost:5173
npm run build      # typecheck (tsc -b) + build Vite
npm run test       # testes unitários (Vitest)
npm run test:e2e   # testes E2E (Playwright)
npm run preview    # serve o build (--host para testar no celular da rede)
```

Teste no celular: abra `http://<ip-da-maquina>:4173` (HTTPS necessário para a câmera) ou use o deploy.

## 🧰 Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | React 18 + TypeScript + Vite 5 |
| Dados locais | Dexie + dexie-react-hooks (IndexedDB) |
| Sync | @supabase/supabase-js (e-mail + senha, RLS) |
| Animações | GSAP + @gsap/react |
| Ícones | lucide-react |
| Exports | jspdf + jspdf-autotable (PDF) · xlsx (Excel) · jszip + file-saver (ZIP) |
| PWA | vite-plugin-pwa (`registerType: 'prompt'` — banner de atualização) |
| Testes | Vitest + Playwright (CI no GitHub Actions) |

### Estrutura

```
src/
├── nav.ts                # tipo Screen (home | new-campaign | collect | indices | export)
├── App.tsx               # troca de telas com GSAP, toast global, banner PWA
├── screens/              # Home · NewCampaign · Collect · Indices · Export
├── components/           # CameraOverlay (torch + zoom) · AptButton · ProgressRing · GlassCard · Background
├── db/                   # schema Dexie (campaigns, records) + CRUD (upsertRecord)
├── lib/                  # towers.ts · utils.ts · camera.ts · validate.ts · backup.ts · sync.ts · exportPdf/excel/zip
└── hooks/usePhotoUrl.ts  # Blob → ObjectURL com revogação
```

## 📦 Exports

| Saída | Arquivo | Conteúdo |
| --- | --- | --- |
| PDF | `${label}-relatorio.pdf` | Relatório formatado, com opção de incluir as fotos |
| Excel | `${label}-indices.xlsx` | Planilha com todos os índices |
| ZIP | `${label}-fotos.zip` | Todas as fotos organizadas |

`label` = nome + mês + ano da campanha.

## ☁️ Sincronização e backup

- **Backup/Restaurar** (card "Seus dados" no app): baixa um JSON com campanhas + registros e fotos, e restaura substituindo os dados locais.
- **Sync Supabase**: opcional. Crie `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e aplique `supabase/schema.sql` no seu projeto. Sem essas variáveis o app funciona 100% local, apenas com backup.
- O merge é "last-write-wins" por `updatedAt` (push → pull → push se houver pull).

## 🎨 Design

Paleta "visor de medidor": fundo oceano escuro `#071822`, ciano `#5eead4`, glassmorphism. Fontes: Unbounded (display), Outfit (texto), JetBrains Mono (códigos).

## 🔒 Privacidade

Os dados são armazenados **somente no dispositivo** (IndexedDB) por padrão. A sincronização na nuvem é **opcional e por login** — só ativa se você configurar as variáveis de ambiente do Supabase. O deploy Vercel serve apenas os arquivos estáticos do PWA.

## 📄 Licença

MIT — use, adapte e contribua à vontade.
