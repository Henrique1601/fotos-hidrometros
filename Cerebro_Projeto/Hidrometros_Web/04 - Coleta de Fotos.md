# 04 - Coleta de Fotos

## Organização

- Torres A–H, andares 03–25.
- Duas colunas por andar: **ESQUERDA** e **DIREITA**.
- Lado por unidade:
  - unidade ∈ [3,4,5,6] → **esquerda**
  - unidade ∈ [1,2,7,8] → **direita**
- Andar 03: unidades 1–4 em A/B/D/F; 1–5 em C/E/G/H. Andares 04–25: 1–8.

## Fluxo de captura

1. Tap no apartamento (ex: `123`, lado esquerdo).
2. Câmera abre (getUserMedia, traseira) com moldura de enquadramento (reticle).
3. Captura → pré-visualização.
4. **"Salvar e próximo"** → grava Blob no IndexedDB (`upsertRecord`, preserva índice) → avança para o próximo ap da **mesma coluna**.
5. **"Refazer"** → captura novamente sem salvar.

## Fallback de câmera

- `getUserMedia` negado ou indisponível → `input type=file capture=environment` (câmera nativa do sistema).

## Detalhes de implementação

- `CameraOverlay` recebe o ap atual via props; o componente pai (`Collect`) remonta o overlay com `key={aptCode}` para **evitar preview obsoleto** ao trocar de apartamento no auto-avanço.
- Título do overlay mostra `Andar NN` (zero à esquerda no andar, ex: "Andar 03").
- Estado do ap na tela: vazio | com foto | com foto + índice.
- Barra de progresso (ProgressRing) atualiza em tempo real via useLiveQuery.

Ver também: [[00 - Visão Geral]] · [[01 - Arquitetura]]
