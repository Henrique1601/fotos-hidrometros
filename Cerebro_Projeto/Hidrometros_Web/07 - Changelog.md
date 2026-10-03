# 07 - Changelog

## 2026-10-03 — Download de Backup da Nuvem Supabase e Correção de Alinhamento Mobile

### Feito

- **Download de Backup da Nuvem Supabase (`src/lib/sync.ts` + `SyncScreen.tsx` + `DataScreen.tsx`)**:
  - Implementada a função `fetchCloudBackupData` com paginação progressiva (`.range()`), gerando um objeto `BackupFile` idêntico e 100% compatível com o formato JSON local oficial do FotoHidro (`isValidBackup`).
  - Implementada a função `downloadCloudBackup`, que faz download automático de arquivo `.json` com nome semântico `foto-hidro-backup-nuvem-Xmedicoes-TIMESTAMP.json`, contendo todas as campanhas e fotos base64 salvas no banco remoto.
  - Implementada a função `restoreFromCloud`, permitindo puxar os dados da nuvem diretamente para o banco IndexedDB local nos modos 'replace' e 'merge'.
  - Adicionado botão explícito **"Baixar Backup da Nuvem (.json)"** com indicador de progresso e botão **"Restaurar Nuvem para este Aparelho"** com diálogo de confirmação seguro na tela `SyncScreen.tsx`.
  - Integrado botão de atalho **"Baixar da Nuvem"** no card da Nuvem Supabase da tela `DataScreen.tsx`.

- **Correção de Alinhamento e Overflow do Botão da Nuvem no Mobile (`src/styles.css` + `Home.tsx`)**:
  - Diagnosticada e corrigida a sobreposição/corte horizontal em telas de smartphones estreitas (360px a 430px).
  - Adicionada contenção `min-width: 0`, `overflow: hidden` e `flex: 1 1 auto` no `.logo-row` com encapsulamento `.logo-text`.
  - Configurada `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` no subtítulo, ocultando-o em larguras <= 370px para garantir respiro total ao cabeçalho.
  - Otimizada a `.home-toolbar` para `flex-shrink: 0`, com botões de 38px e gap de 6px em telas <= 480px.
  - Ocultado o botão de atalhos de teclado (`.home-shortcuts-btn`) em viewports móveis (telas touch não possuem teclado físico), garantindo que os 3 botões essenciais (Câmera, Dados e Nuvem com dot de status) fiquem 100% visíveis, confortáveis ao toque e perfeitamente alinhados à direita.
  - Corrigida a sincronia de seletores CSS `.cloud-dot-badge` com os estados `synced`, `pending`, `offline` e `unconfigured`.

### Testes

- `npm run test`: **86/86** testes unitários aprovados (adicionado `cloudBackup.test.ts` com cobertura de geração de backup, sessão e restauração local).
- `npm run test:e2e`: **7/7** testes Playwright E2E aprovados, incluindo testes específicos de contenção mobile a 360px (`cloudBtn.boundingBox().x + width <= 360`) e fluxo de backup na nuvem.
- `npm run build`: Typecheck TypeScript (`tsc -b`) e build Vite de produção 100% aprovados.

---

## 2026-10-01 — Correção da Exclusão de Fotos na Grade de Hidrômetros

### Feito

- **Correção da Remoção de Fotos no Botão "X" (`src/db/records.ts` + `src/screens/Collect.tsx`)**:
  - Identificada e corrigida a inversão dos parâmetros nas funções `resetRecord` e `deleteRecord` em `src/db/records.ts`.
  - A assinatura anterior `(campaignId: number, aptCode: string, towerId: string)` recebia os argumentos na ordem `(campaignId, towerId, aptCode)` vinda de `Collect.tsx`, o que fazia a consulta IndexedDB falhar silenciosamente ao comparar o código do apartamento com o ID da torre e vice-versa.
  - A assinatura e implementação foram padronizadas para `(campaignId: number, towerId: string, aptCode: string)`, compatibilizando com as demais rotinas do banco (`listTowerRecords`, `upsertRecord`).
  - O `resetRecord` agora localiza todos os registros correspondentes ao hidrômetro, reseta `photo: null`, `index: null`, `capturedAt: null`, `indexedAt: null`, atualiza `updatedAt: Date.now()` (para replicação adequada via sync LWW) e elimina eventuais registros duplicados fantasmas.
  - O card do apartamento (`AptButton`) reage instantaneamente via `useLiveQuery`, voltando ao estado inicial vazio e ocultando o botão "X".

### Testes

- `npm run test`: **83/83** testes unitários aprovados (novos testes adicionados em `cloudAndLock.test.ts` para `resetRecord` e `deleteRecord`).
- `npm run test:e2e`: **5/5** testes Playwright E2E aprovados, incluindo novo teste validando a exclusão de foto pelo botão "X", exibição do modal de confirmação e transição do card para `apt-empty`.
- `npm run build`: Typecheck TypeScript (`tsc -b`) e build Vite de produção 100% aprovados.

---

## 2026-10-01 — Indicador de Status Nuvem, Instalação PWA, Bloqueio de Medições Concluídas e Otimização de Sync

### Feito

- **Indicador Dinâmico de Status na Nuvem no Topo** (`src/hooks/useCloudStatus.ts` + `src/screens/Home.tsx` + `src/styles.css`):
  - Criado o hook `useCloudStatus` que reage em tempo real a alterações nas campanhas/registros locais e no estado de autenticação do Supabase.
  - Indicador visual colorido integrado no botão Nuvem do cabeçalho da Home com feedback por tooltip:
    - 🟢 **Verde** (`synced`): banco local 100% sincronizado com a nuvem Supabase.
    - 🟡 **Âmbar pulsante** (`pending`): alterações locais pendentes de envio para a nuvem.
    - ⚪ **Cinza** (`offline` / `unconfigured`): nuvem desconectada ou pendente de login.
- **Botão e Card de Instalação do PWA na Tela Inicial** (`src/hooks/usePwaInstall.ts` + `src/screens/Home.tsx` + `src/styles.css`):
  - Captura antecipada e global do evento nativo `beforeinstallprompt` sem perda de disparos pré-montagem.
  - Card estilizado "Instalar FotoHidro" na tela inicial com botão direto de instalação, detecção de modo *standalone* e opção de dispensar.
  - Modal auxiliar inteligente com instruções passo a passo para instalação no iOS Safari ("Compartilhar ➔ Adicionar à Tela de Início") e Android/Chrome.
- **Bloqueio de Segurança para Medições Concluídas** (`Collect.tsx` + `Indices.tsx` + `Export.tsx` + `Home.tsx` + `CameraOverlay.tsx`):
  - Botão e selo de status "Concluída" (`status === 'done'`) nos cards da tela inicial e no cabeçalho do Export.
  - Diálogos de confirmação explícitos para Concluir ou Reabrir medições.
  - **Bloqueio na Coleta de Fotos (`Collect.tsx`)**: Banner persistente de medição bloqueada; câmera abre em modo somente leitura para inspeção das fotos já salvas, impedindo novas capturas, substituições ou exclusões acidentais.
  - **Bloqueio nos Índices (`Indices.tsx`)**: Banner com botão de reabrir; campo de digitação de índice e botões de OCR desabilitados em modo somente leitura.
  - Seletor de status integrado na edição de campanhas e botão direto de conclusão na tela de Exportação.
- **Otimização de Performance e Memória no Sync Supabase** (`src/lib/sync.ts` + `src/screens/SyncScreen.tsx`):
  - **Streaming em Lotes (Push)**: Envio particionado em batches de 25 registros com limpeza de memória intermediária, reduzindo o pico de consumo de RAM de ~800MB para ~15MB.
  - **Paginação Progressiva (Pull)**: Remoção do gargalo fixo de 5.000 registros com leitura progressiva em `.range()` sem limites.
  - Indicador numérico em tempo real de registros processados na tela de Sincronização.

### Testes

- `npm run test`: **81/81** testes unitários aprovados (12 arquivos de teste com `cloudAndLock.test.ts`).
- `npm run test:e2e`: **4/4** testes Playwright E2E aprovados, incluindo novo teste dedicado de bloqueio/desbloqueio de medições.
- `npm run build`: Typecheck TypeScript (`tsc -b`) e build Vite de produção 100% aprovados.

---

## 2026-10-01 — Retomada de Navegação, Backup Flexível, Bip/Vibração, Resumo WhatsApp, Filtro de Pendências e Nome do Leiturista

### Feito

- **Retomada Precisa da Medição** (`Collect.tsx` + `Home.tsx` + `App.tsx` + `db.ts`):
  - Ao clicar em "Continuar", o app restaura exatamente a torre, andar e apartamento onde a medição foi interrompida, sem resetar para o primeiro andar incompleto.
  - Persistência contínua de `lastTower`, `lastFloor` e `lastApt` no banco de dados da campanha.
- **Sistema Flexível de Backup & Restauração** (`src/lib/backup.ts` + `src/screens/DataScreen.tsx` + `src/styles.css` + `backup.test.ts` + `e2e/app.spec.ts`):
  - **Exportação Flexível**: Completo (Fotos + Índices), Apenas Índices (Leve) e Apenas Fotos, com seleção de períodos.
  - **Restauração com Filtros**: Ao importar um arquivo `.json` de backup, o usuário pode selecionar quais campanhas/meses do arquivo deseja restaurar e escolher o tipo de conteúdo a ser importado (Completo, Apenas Índices ou Apenas Fotos).
  - **Modos de Restauração**: Escolha entre "Substituir Tudo" (limpeza da base e inserção dos selecionados) ou "Mesclar / Adicionar" (preserva dados locais e atualiza/adiciona seletivamente apenas índices ou fotos).
  - **Testes**: Cobertura completa de testes unitários para todos os fluxos de restauração com `fake-indexeddb` e teste E2E com Playwright.
- **Bip Sonoro & Vibração no Disparo** (`src/lib/audioHaptics.ts` + `CameraOverlay.tsx` + `Home.tsx`):
  - Síntese rápida de áudio Web Audio (clique de obturador) + vibração háptica em disparos normais e no modo burst.
  - Botão de alternância rápida de Som no HUD da câmera e na tela inicial.
- **Gerador de Resumo para WhatsApp** (`src/screens/Export.tsx`):
  - Botão "Copiar Resumo p/ WhatsApp" com relatório formatado contendo porcentagem de conclusão, ritmo médio, velocidade e dados do leiturista.
- **Filtro de Apenas Pendências** (`src/screens/Collect.tsx` + `src/screens/Indices.tsx`):
  - Botão de alternância nos controles para visualizar apenas apartamentos sem fotos na Coleta e fotos sem leitura nos Índices.
- **Identificação do Leiturista nos Relatórios** (`NewCampaign.tsx` + `exportPdf.ts` + `exportExcel.ts` + `Export.tsx`):
  - Campo de leiturista na criação e edição de campanhas com memória automática no dispositivo.
  - Exibição destacada na capa e cabeçalhos do relatório PDF e na planilha Excel.
- **Correções Visuais de Layout & Responsividade** (`src/styles.css`):
  - Corrigido alinhamento e empilhamento das pílulas de torres no topo da tela de exportação (`.tower-pills`).
  - Ajustada proporção da foto em dispositivos móveis menores para assegurar que o botão "Avançar" nos índices nunca saia da área visível.

### Testes

- `npm run test`: **66/66** testes unitários aprovados (10 arquivos de teste).
- `npm run test:e2e`: **3/3** testes E2E Playwright aprovados.
- `npm run build`: build Vite de produção concluído com sucesso.

---

## 2026-09-10 — Filtros Rápidos de Índices, Auto-OCR em Fundo, Comprovante WhatsApp e Comparativo Multimeses

### Feito

- **Filtros Rápidos e Focados na Tela de Índices** (`src/screens/Indices.tsx` + `src/styles.css`):
  - Inserida barra de filtros por chips no topo da tela de Índices:
    - `Todos (total)`
    - `Pendentes (qtd)`: filtra apenas apartamentos com foto que ainda não possuem índice digitado.
    - `Com Alerta (qtd)`: filtra apenas apartamentos com alertas de inconsistência (consumo > 30 m³, regressão ou números vermelhos/litros).
  - Toda a navegação (`←` / `→`, `Enter`, `A` / `D`, PageUp / PageDown) adapta-se automaticamente à lista filtrada ativa.
  - Ao salvar o índice de um apartamento pendente, o app avança suavemente para o próximo pendente da fila.
  - Adicionados estados vazios dedicados com ilustrações quando a torre atinge 100% de preenchimento ou não possui alertas.
- **Fila de Auto-OCR em Segundo Plano pós-captura** (`src/lib/bgOcr.ts` + `src/components/CameraOverlay.tsx`):
  - Criado o método `enqueue(recordId, photo)` no `BgOcrManager`.
  - No modo contínuo / burst da câmera, a foto é enfileirada para processamento de OCR em background sem travar o ritmo ágil de fotos do leiturista.
- **Comprovante Individual e Compartilhamento via WhatsApp para o Morador** (`src/lib/voucher.ts` + `src/lib/voucher.test.ts` + `src/screens/Indices.tsx` + `src/screens/HistoryScreen.tsx` + `src/styles.css`):
  - Desenvolvido módulo `voucher.ts` com testes unitários (100% de cobertura).
  - Botão de WhatsApp (`Share2`) presente diretamente na barra de navegação da tela de Índices e em cada card de histórico do apartamento (`HistoryScreen`).
  - Gera comprovante fotográfico formatado com identificação do condomínio, torre, apartamento, data/hora, índice anterior, índice atual, consumo mensal e alertas de consumo atípico.
  - Suporte a `navigator.share` nativo com envio de foto e texto, e fallback inteligente abrindo diretamente o WhatsApp Web/App com a mensagem pronta.
- **Dashboard Comparativo Multimeses de Consumo** (`src/screens/ConsumptionScreen.tsx` + `src/styles.css`):
  - Adicionada seção de *Comparativo Entre Meses* na tela de Consumo com análise temporal automática de todas as campanhas cadastradas no condomínio.
  - Barras visuais proporcionais de consumo total ($m^3$) e consumo médio por apartamento ($m^3$/apt).
  - Cálculo automático de variação percentual ($\Delta\%$) em relação à medição anterior com badges visuais de aumento (vermelho) ou redução (verde).

---

## 2026-09-09 — Otimizações de Banco, PWA Offline Resiliente, Limpeza de CSS e Melhorias de UX

### Feito

- **Otimização de Memória e Consultas no Banco IndexedDB** (`src/screens/HistoryScreen.tsx`):
  - Refatorada a busca do histórico de medições do apartamento (`HistoryScreen`): anteriormente carregava a tabela inteira de registros com todos os blobs de fotos de todas as campanhas na memória RAM via `db.records.toArray()`.
  - Agora executa consulta indexada filtrada no Dexie: `db.records.where('towerId').equals(towerId).filter(...)`, economizando centenas de megabytes de RAM em condomínios com milhares de fotos.
- **PWA Offline Resiliente & Precaching Total** (`vite.config.ts`):
  - Removidos padrões frágeis de `globIgnores` que excluíam chunks de tela grandes da instalação offline (`Export`, etc.).
  - Configurado `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` no Workbox, garantindo que 100% dos assets e telas fiquem armazenados no Service Worker para uso completo em campo sem internet.
- **Limpeza de Código Morto e Altura Dinâmica de Viewport Mobile** (`src/components/Background.tsx` e `src/styles.css`):
  - Removidos elementos órfãos (`.orb` e `.bg-wave`) do componente `Background` e suas regras mortas (`display: none`) de `styles.css`.
  - Adicionado suporte a `100dvh` com fallback `100vh` em `#root`, `.app`, `.app-main` e `.camera-overlay`, eliminando saltos de layout e overflow causados pela barra de endereço dinâmica e teclado virtual em smartphones Android e iOS.
- **Aprimoramento de Estados Vazios (Empty States UX)** (`src/screens/Export.tsx` e `src/screens/ConsumptionScreen.tsx`):
  - Na tela de Exportação (`Export.tsx`), quando a campanha não possui registros, os botões de exportação e compartilhamento ficam desabilitados com aviso visual orientando a coleta de fotos antes da geração.
  - Na tela de Consumo (`ConsumptionScreen.tsx`), adicionada diferenciação inteligente: quando a campanha possui índices mas é a primeira campanha cadastrada (sem campanha anterior para comparação), o app exibe um card explicativo indicando "Campanha Base Inicial", em vez de uma mensagem enganosa de "Nenhum índice preenchido".

---

## 2026-09-08 — Atalhos de Teclado Globais, Navegação Foto a Foto e Lupa Interativa

### Feito

- **Atalhos Globais na Tela de Índices & Fotos** (`src/screens/Indices.tsx`):
  - **Navegação rápida entre fotos**:
    - `→` / `PgDn` / `Alt+→` / `D`: avança para a próxima foto/apartamento.
    - `←` / `PgUp` / `Alt+←` / `A`: volta para a foto/apartamento anterior.
    - `Enter`: salva o índice digitado e avança automaticamente para o próximo apartamento.
    - `0–9` / `,` / `.`: quando fora do campo, foca automaticamente no input do índice para digitação imediata.
    - `Z` ou `Espaço`: abre/fecha a foto ampliada (Lightbox).
    - `Ctrl+Z` / `Alt+Z`: desfaz o último índice salvo.
    - `Alt+O` ou `O`: lê o hidrômetro atual com OCR.
    - `[` e `]`: alterna entre as Torres (A ↔ H).
    - `/` ou `Ctrl+F`: abre a busca rápida de apartamento por número.
    - `Esc`: fecha o Lightbox, a barra de busca, os atalhos ou cancela o foco.
  - **Lupa com Zoom Interativo no Mouse** (`src/screens/Indices.tsx` + `src/styles.css`):
    - Ao passar o mouse sobre a foto principal nos Índices, uma lente de aumento de 2.3× acompanha a posição do cursor (`transform-origin`).
  - **Guia Visual de Atalhos de Teclado** (`src/components/ShortcutsModal.tsx` + `src/styles.css`):
    - Modal interativo pressionando `?` ou clicando no ícone de teclado (`Keyboard`).
- **Higienização de Registros Órfãos no Banco Dexie** (`src/db/records.ts`):
  - Função `cleanOrphanAndDuplicateRecords` que remove automaticamente registros com códigos inválidos e mescla duplicatas.
- **Calibração do Total do Condomínio para 1.435 Unidades**:
  - Removido apartamento 35 da Torre E (o 3º andar da Torre E possui 4 unidades: 31, 32, 33, 34).

---

## 2026-09-01 — Tempo de Medição & Produtividade, OCR em Segundo Plano e Mira Guia de Enquadramento

### Feito

- **Mira Guia de Enquadramento no Visor da Câmera** (`src/components/CameraOverlay.tsx` + `src/styles.css`):
  - Retângulo guia visual com cantos em ciano brilhante, linha central de mira e legendas indicativas para dígitos pretos (m³) e vermelhos (Litros).
  - Botão de alternância rápida `MIRA` nos controles da câmera com persistência no `localStorage`.
- **OCR em Segundo Plano (Background Batch OCR)** (`src/lib/bgOcr.ts` + `src/screens/Indices.tsx`):
  - Fila assíncrona gerenciada por singleton que processa automaticamente todas as fotos pendentes de leitura no banco Dexie sem travar a interface.
  - Barra de status na tela de Índices com botão "Ler todas" / "Pausar" e contagem em tempo real de fotos processadas e índices reconhecidos.
  - Feedback de cálculo de consumo instantâneo durante a digitação na tela de Índices com avisos de anomalia (regressão negativa ou consumo alto > 30 m³).
- **Tempo de Medição & Métricas de Produtividade** (`src/lib/measurementStats.ts` + `Home.tsx` + `Collect.tsx` + `Export.tsx`):
  - Cálculo de tempo ativo real (descontando pausas longas/almoço > 10 min), ritmo médio por apartamento (ex.: `14s/un`) e velocidade de leitura (ex.: `240 un/h`).
  - Exibição de tempo e ritmo nos cards da tela inicial (`Home.tsx`).
  - HUD de tempo da torre ativa no cabeçalho da tela de coleta (`Collect.tsx`).
  - Card dedicado de "Produtividade & Tempo" com resumo por torre na tela de exportação (`Export.tsx`).

### Testes

- `npm run test`: **61/61** testes unitários aprovados (9 arquivos de teste).
- `npm run test:e2e`: **3/3** testes E2E Playwright aprovados.
- `npm run build`: build Vite concluído com sucesso.

---

## 2026-08-02 — Consumo, marca d'água, export por torre e busca de apt

### Feito

- **Consumo vs. mês anterior** (`src/lib/consumption.ts` + `consumption.test.ts`): `selectPreviousCampaign` escolhe a campanha imediatamente anterior; `computeConsumption` calcula `consumo = atual - anterior` com status `ok`/`anomaly`/`no-base`; `loadConsumption` monta `Map<torre:apt, Consumo>`. 9 testes.
- **Marca d'água nas fotos** (`src/lib/watermark.ts`): `watermarkPhoto(blob, text)` redimensiona para `maxW=1280`, desenha barra `rgba(7,24,34,0.72)` com texto branco em JetBrains Mono (label `${aptCode} · dd/mm/aaaa HH:mm`), salva JPEG 0.85; usada no PDF e no ZIP quando a opção está ativa.
- **Export por torre + consumo** (`exportPdf/exportExcel/exportZip.ts`): opções `{ towerId?, watermark? }`; PDF com coluna "Consumo" e anomalias destacadas em vermelho/negrito via `didParseCell`; Excel com sheet "Consumo" nova e coluna Consumo no sheet Índices; ZIP filtra por torre.
- **Busca/atalho por apt** (`Collect.tsx` + `Indices.tsx`): form `.apt-jump` com ícone de busca.

---

## 2026-08-02 — Rodada funcionalidades: backup, sync, torch/zoom, validação, export completo e CI

### Feito

- **Backup/Restore local** (`src/lib/backup.ts`): card "Seus dados" no Home com botões Backup e Restaurar.
- **Sync Supabase** (`src/lib/sync.ts` + `supabase/schema.sql`): login e-mail/senha, `pushAll`, `pullAll`, `syncAll`.
- **Câmera torch + zoom** (`camera.ts` + `CameraOverlay.tsx`): capabilities, `setTorch`/`setZoom`, botão de luz e controles de zoom (+/− e pinch).
- **Validação de índices** (`validate.ts` + `Indices.tsx`): `validateIndex` (decimal pt-BR, outliers por desvio padrão).
- **Export completo + Compartilhar** (`exportZip/exportPdf/exportExcel.ts` + `Export.tsx`): PDF + Excel + ZIP.
- **CI** (`.github/workflows/ci.yml`): job `test` (vitest + build) e job `e2e` (Playwright).

---

## 2026-07-31 — Implementação v1.0.0

### Feito

- **Repo GitHub criado e conectado à Vercel** — `Henrique1601/fotos-hidrometros` (privado), push na `main` = deploy automático de produção.
- **Deploy Vercel concluído** — https://fotos-hidrometros.vercel.app.
- **Banco:** schema Dexie `fotos-hidrometros` v1 (tabelas `campaigns` e `records`).
- **CRUD:** `records.ts` com `upsertRecord`.
- **Telas:** Home, NewCampaign, Collect, Indices, Export.
- **Componentes:** CameraOverlay, AptButton, ProgressRing, GlassCard, Background.
- **Navegação:** `App.tsx` com troca de telas GSAP, toast global e banner de atualização PWA.

---

Ver também: [[00 - Visão Geral]] · [[06 - Deploy]]
