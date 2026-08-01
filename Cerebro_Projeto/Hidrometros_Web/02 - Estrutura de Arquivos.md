# 02 - Estrutura de Arquivos

```
Fotos-Hidrometros_Web/
├── AGENTS.md                       # instruções de contexto p/ agentes (use skills!)
├── Cerebro_Projeto/Hidrometros_Web/  # vault Obsidian deste projeto
├── docs/superpowers/specs/
│   └── 2026-07-31-foto-hidrometros-design.md  # spec aprovada
├── public/                         # ícones PWA, manifest
├── scripts/generate-icons.ps1      # regenera ícones PWA (npm run icons)
├── src/
│   ├── nav.ts                      # tipo Screen
│   ├── App.tsx                     # navegação GSAP + toast + banner SW
│   ├── main.tsx                    # bootstrap
│   ├── styles.css                  # tema completo (glassmorphism, dark/cyan)
│   ├── screens/
│   │   ├── Home.tsx                # lista de campanhas + progresso + deletar
│   │   ├── NewCampaign.tsx         # nome/mês/ano + grid de torres
│   │   ├── Collect.tsx             # chips de andar + colunas Esq/Dir + câmera
│   │   ├── Indices.tsx             # leitura dos índices (Enter avança/salva)
│   │   └── Export.tsx              # PDF / Excel / ZIP + toggle de fotos no PDF
│   ├── components/
│   │   ├── CameraOverlay.tsx       # câmera + fallback de arquivo + auto-avanço
│   │   ├── AptButton.tsx           # botão de apartamento com estado
│   │   ├── ProgressRing.tsx        # anel de progresso
│   │   ├── GlassCard.tsx           # card glassmorphism
│   │   └── Background.tsx          # fundo com manchas de luz
│   ├── db/
│   │   ├── db.ts                   # schema Dexie (fotos-hidrometros, v1)
│   │   └── records.ts              # CRUD + upsertRecord
│   ├── lib/
│   │   ├── towers.ts               # config do condomínio (torres/andares/lados)
│   │   ├── utils.ts                # helpers (pad2, label, etc.)
│   │   ├── camera.ts               # getUserMedia helper
│   │   ├── exportPdf.ts            # jspdf + jspdf-autotable
│   │   ├── exportExcel.ts          # xlsx
│   │   └── exportZip.ts            # jszip + file-saver
│   └── hooks/
│       └── usePhotoUrl.ts          # Blob → ObjectURL com revogação
├── vite.config.ts                  # vite-plugin-pwa
├── package.json                    # fotos-hidrometros v1.0.0
└── tsconfig*.json
```

## Convenções

- Sem comentários em código a menos que solicitado.
- Padrões existentes: glass cards, hooks, exportadores.
- Mobile-first — testar em viewport ~390px.

Ver também: [[01 - Arquitetura]] · [[03 - Banco de Dados Local]]
