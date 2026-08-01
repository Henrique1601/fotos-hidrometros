# Design — PWA "Fotos Hidrômetros"

**Data:** 2026-07-31
**Status:** Aprovado (com ajuste: códigos de apartamento sem zero à esquerda)

## Visão Geral

Aplicativo PWA mobile-first para leiturista de um condomínio com 8 torres (A–H). O app organiza os apartamentos por andar e lado (esquerda/direita), permitindo fotografar hidrômetros rapidamente sem digitar o número do apartamento, preencher os índices depois e exportar em PDF/Excel, além de exportar as fotos para o aparelho.

Referência de produto: Siscon Medição (Android).

## Requisitos Funcionais

1. **Cadastro/geração da estrutura do condomínio** a partir do padrão informado (8 torres, andares 03–25).
2. **Campanhas mensais** de medição (ex: "Julho 2026"), com histórico preservado.
3. **Coleta de fotos** com câmera integrada (getUserMedia), organizada por torre → andar → lado:
   - Lado **esquerdo**: unidades que terminam em **3, 4, 5, 6**
   - Lado **direito**: unidades que terminam em **1, 2, 7, 8**
   - Tap no apartamento abre a câmera; após capturar, **auto-avança** para o próximo apartamento da mesma coluna.
4. **Preenchimento de índices** posterior, no próprio app, com miniatura da foto de cada apartamento.
5. **Exportação**:
   - **PDF** com fotos e índices (relatório por torre).
   - **Excel** com a tabela de índices.
   - **Fotos para o aparelho** (ZIP organizado por Torre/Andar).
6. **PWA instalável** e **offline-first**.

## Estrutura do Condomínio

- 8 torres: A, B, C, D, E, F, G, H.
- Andares: 03 até 25 (23 andares).
- Código do apartamento (sem zero à esquerda): `andar(2 dígitos) + unidade(1 dígito)` → ex: andar 03 unidade 1 = `31`; andar 10 unidade 1 = `101`; andar 25 unidade 8 = `258`.
- **Andar 03**: unidades 1–4 nas torres A, B, D, F; unidades 1–5 nas torres C, E, G, H.
- **Andares 04–25**: unidades 1–8 em todas as torres.

> Nota: na lista fornecida, a Torre E está sem o ap `236` entre `235` e `237`. Como o padrão do andar 25 é ter 1–8, o `236` será incluído (a menos que o usuário confirme que realmente não existe).

### Geração de dados

Gerar programaticamente:

```
para cada torre em [A..H]:
  andar 03:
    unidades = [1,2,3,4] (A,B,D,F) | [1,2,3,4,5] (C,E,G,H)
  andares 04..25:
    unidades = [1,2,3,4,5,6,7,8]
  aptCode = String(andar * 10 + unidade)   // ex: 31, 101, 258
```

### Lado (coluna)

- `unidade ∈ [3,4,5,6]` → `left`
- `unidade ∈ [1,2,7,8]` → `right`

## Arquitetura

- **Build:** Vite + React 18 + TypeScript
- **PWA:** vite-plugin-pwa (Workbox) — precache do app shell, cache de assets, atualização via `updateSW`
- **Persistência:** Dexie (IndexedDB) — fotos como Blob
- **Animações:** GSAP
- **Exportações:**
  - PDF: `jspdf` + `jspdf-autotable`
  - Excel: `xlsx` (SheetJS)
  - ZIP: `jszip` + `file-saver`
- **Ícones:** `lucide-react`

### Modelo de dados (Dexie)

```
towers (tabela estática, sem persistência obrigatória):
  { id: "A", label: "Torre A", floors: [{ floor: 3, units: [1,2,3,4] }, ...] }

campaigns:
  { id, name: "Julho 2026", month, year, createdAt, status: "collecting"|"indexing"|"done" }

records:
  { id, campaignId, towerId, floor, unit, side, aptCode, photo?: Blob, index?: number|null, capturedAt?, indexedAt? }

  Índice único composto: [campaignId + towerId + aptCode]
```

### Telas

1. **Home** — lista de campanhas (cards com progresso), botão "Nova medição".
2. **Nova campanha** — nome/competência (padrão: mês atual) + escolha da torre (grid A–H).
3. **Coleta** — chips de andar (03→25) + duas colunas **ESQUERDA / DIREITA** com os apartamentos. Estado por ap: vazio | com foto | com foto+índice. Tap abre a câmera; auto-avanço na coluna. Barra de progresso.
4. **Câmera** — getUserMedia (traseira), moldura central (reticle), botão de captura, revisão com "refazer" e "salvar e próximo".
5. **Índices** — por torre: lista com miniatura + campo numérico, auto-avanço ao salvar.
6. **Exportar** — resumo + botões: PDF, Excel, Exportar fotos (ZIP).

### Fluxo de captura

1. Usuário toca no apartamento (ex: `123`, lado esquerdo).
2. Câmera abre com moldura de enquadramento.
3. Captura → pré-visualização.
4. "Salvar e próximo" → grava Blob no IndexedDB → avança para o próximo ap da **mesma coluna**.
5. "Refazer" → captura novamente (sem salvar).

## Exportação

### PDF
- Capa: nome da campanha, competência, resumo (nº de fotos, nº de índices).
- Por torre: tabela `andar | ap | índice` + fotos embutidas (miniaturas) organizadas por lado.

### Excel
- Aba **Índices**: `torre | andar | ap | lado | índice`.
- Aba **Resumo**: contagem de fotos/índices por torre.

### Fotos para o aparelho
- ZIP com estrutura `Torre_A/03/ap_31.jpg`, etc.
- Download via `file-saver` (Chrome Android salva em Downloads; usuário pode mover para a galeria).

## Design (UI/UX)

- **Glassmorphism**: cards com `backdrop-filter: blur()`, bordas translúcidas, brilho (sheen).
- **Paleta**: azul-petróleo profundo + ciano (tema água), fundo com manchas de luz, tema escuro.
- **GSAP**: stagger de entrada, transições entre telas, anel de progresso animado, "pop" em contadores.
- Mobile-first, touch-friendly, fonte legível.

## Tratamento de Erros

- Câmera negada → fallback para `input type=file capture=environment`.
- Sem suporte a `getUserMedia` → fallback para input nativo.
- IndexedDB cheio → aviso e sugestão de exportar/limpar campanhas antigas.
- Service worker atualizado → toast "atualização disponível" (recarregar).

## Fora de Escopo (v1)

- Word export (adicional futuro).
- Comparação automática de consumo entre meses.
- Autenticação / backend / sincronização em nuvem.

## Entregáveis

1. Projeto PWA completo no diretório do repositório.
2. **Cérebro para Obsidian** — vault com visão geral, arquitetura, modelo de dados e decisões.
3. **AGENTS.md** — instruções de contexto para o repositório.

## Deploy

- Vercel (HTTPS automático), projeto estático `vite build`.
