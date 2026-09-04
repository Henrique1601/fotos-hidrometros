# 00 - Visão Geral

PWA mobile-first para leiturista de condomínio com 8 torres (A–H). Fotografa hidrômetros por torre → andar → lado (esquerda/direita) com auto-avanço, preenche índices depois e exporta relatório PDF, planilha Excel e ZIP das fotos.

**Referência de produto:** Siscon Medição (Android).

**Stack:** Vite + React 18 + TypeScript, Dexie (IndexedDB local), GSAP, vite-plugin-pwa, jspdf, xlsx, jszip.

## Requisitos funcionais

1. Geração da estrutura do condomínio a partir do padrão (8 torres, andares 03–25).
2. Campanhas mensais de medição com histórico.
3. Coleta de fotos com câmera integrada (getUserMedia), organizada por torre → andar → lado, com auto-avanço na coluna.
4. Preenchimento de índices posterior, com miniatura da foto.
5. Exportação: PDF (fotos + índices), Excel (índices), ZIP das fotos.
6. PWA instalável e offline-first.

## Estrutura do condomínio

- 8 torres: A, B, C, D, E, F, G, H.
- Andares: 03 até 25 nas torres A–G (23 andares); 03 até 24 na torre H (22 andares, não possui 25º andar).
- Código do ap (sem zero à esquerda): `andar(2 dígitos) + unidade(1 dígito)` → `31`, `101`, `258`.
- Andar 03: unidades 1–4 em A/B/D/F; 1–5 em C/E/G/H. Andares 04–25 (04–24 na torre H): 1–8.
- Total do condomínio: 1.435 apartamentos (Torres A/B/D/E/F = 180 cada, C/G = 181 cada, H = 173).
- Lado: unidade ∈ [3,4,5,6] → esquerda; ∈ [1,2,7,8] → direita.

> **Pendência:** Torre E pode não ter o ap `236` (entre `235` e `237`). Foi incluído seguindo o padrão do andar 25; confirmar com o cliente.

## Fluxo do usuário

1. Criar campanha mensal (nome/competência + torre).
2. Fotografar por coluna (Esq/Dir) — tap abre câmera, "Salvar e próximo" avança para o próximo ap da mesma coluna.
3. Preencher índices (Enter avança e salva).
4. Exportar PDF / Excel / ZIP.

## Status

- **Data da spec:** 2026-07-31 — aprovada (com ajuste: códigos sem zero à esquerda).
- **Implementação:** funcional e testada (build OK, fluxo completo validado em Chrome headless). Deploy Vercel pendente na sessão de finalização.
- **Fora de escopo v1:** export Word, comparação de consumo entre meses, autenticação/sincronização em nuvem.

Ver também: [[01 - Arquitetura]] · [[02 - Estrutura de Arquivos]] · [[03 - Banco de Dados Local]] · [[04 - Coleta de Fotos]] · [[05 - Design]] · [[06 - Deploy]] · [[07 - Changelog]]
