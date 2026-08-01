# 01 - Arquitetura

## Visão

PWA estático mobile-first, offline-first, 100% local. Sem backend. Dados persistidos em IndexedDB via Dexie.

## Camadas

```
src/
├── nav.ts                    # tipo Screen (home | new-campaign | collect | indices | export)
├── App.tsx                   # troca de telas com transição GSAP, toast global, banner de atualização PWA
├── main.tsx                  # bootstrap React + PWA register
├── screens/                  # Home, NewCampaign, Collect, Indices, Export
├── components/               # CameraOverlay, AptButton, ProgressRing, GlassCard, Background
├── db/                       # db.ts (schema Dexie), records.ts (CRUD)
├── lib/                      # towers.ts, utils.ts, camera.ts, exportPdf/exportExcel/exportZip
└── hooks/                    # usePhotoUrl (Blob → ObjectURL com revogação)
```

## Decisões-chave

- **Fotos como Blob no IndexedDB** — sem backend, offline-first. Lida com limite de armazenamento avisando para exportar/limpar.
- **Câmera com fallback:** getUserMedia (traseira); se negado ou sem suporte → `input type=file capture=environment`.
- **Auto-avanço:** após "Salvar e próximo", avança para o próximo ap da **mesma coluna** (lado).
- **PWA `registerType: 'prompt'`:** banner "atualização disponível" com recarregar em vez de atualização silenciosa.
- **Código do ap sem zero à esquerda na UI** (`31`, `101`, `258`); internamente `aptCode = String(andar * 10 + unidade)`.

## Animações

- GSAP + @gsap/react (useGSAP): stagger de entrada, transição entre telas, anel de progresso animado, pop em contadores.

## Exportadores

Recebem o objeto campanha (NÃO `{campaignId}`):

| Exportador | Assinatura | Arquivo |
|---|---|---|
| `exportPdf` | `(campaign, includePhotos?)` | `${label}-relatorio.pdf` |
| `exportExcel` | `(campaign)` | `${label}-indices.xlsx` |
| `exportPhotosZip` | `(campaign)` | `${label}-fotos.zip` |

## Tratamento de erros

- Câmera negada → fallback input de arquivo.
- IndexedDB cheio → aviso + sugestão de exportar/limpar.
- SW atualizado → toast de atualização (recarregar).

Ver também: [[00 - Visão Geral]] · [[02 - Estrutura de Arquivos]] · [[03 - Banco de Dados Local]]
