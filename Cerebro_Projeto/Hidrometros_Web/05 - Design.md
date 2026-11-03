# 05 - Design

## Conceito

Tema "visor de medidor" com estética moderna inspirada no preview `hidrometro-motion` — oceano profundo ultra-escuro, acentos ciano neon/teal vibrantes, superfícies de vidro translúcidas acetinadas (*frosted glassmorphism*) e iluminação volumétrica com orbs de luz dinâmicos.

## Paleta e Tokens

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#030F16` | Fundo principal oceano profundo |
| `--bg-2` | `#081E29` | Superfície secundária / gradientes de base |
| `--ocean` | `#030F16` | Fundo base escuro dos componentes |
| `--surface` | `rgba(12, 40, 55, 0.65)` | Superfície glassmorphic padrão |
| `--surface-strong` | `rgba(8, 30, 41, 0.82)` | Superfície elevada para modais e painéis HUD |
| `--border` | `rgba(45, 212, 191, 0.14)` | Borda translúcida teal de alta precisão |
| `--border-strong` | `rgba(94, 234, 212, 0.32)` | Borda ciano brilhante para hover e seleções ativas |
| `--cyan` | `#5EEAD4` | Destaque primário ciano vibrante |
| `--cyan-glow` | `rgba(94, 234, 212, 0.24)` | Glow neon e anéis de foco |
| `--teal` | `#2DD4BF` | Tom intermediário de gradientes |
| `--teal-deep` | `#0E3D4A` | Superfícies ativas secundárias |

## Tipografia

| Fonte | Família | Uso |
|---|---|---|
| **DM Sans** | `'DM Sans', -apple-system, sans-serif` | Tipografia principal (corpo, botões, títulos modernos, números dinâmicos) |
| **Unbounded** | `'Unbounded', sans-serif` | Display de branding e logos principais |
| **Outfit** | `'Outfit', sans-serif` | Legendas e textos secundários |
| **JetBrains Mono** | `'JetBrains Mono', monospace` | Códigos de apartamento, leituras numéricas e métricas de hidrômetro |

## Componentes Visuais

- **GlassCard (`.glass`, `.card-surface`)**: Cartões com `backdrop-filter: blur(20px) saturate(140%)`, gradiente de iluminação sutil de topo e borda translúcida teal com elevação interativa.
- **Background (`.bg-orbs`)**: Luz volumétrica radial em três camadas atmosféricas (teal, cyan e deep blue) criando profundidade orgânica no fundo da aplicação.
- **AptButton (`.apt-btn`)**: Botões de apartamento com raio suave de 18px, microinterações táteis de pressão (`active: scale(0.96)`), transição suave de elevação e anéis neon para status de foto capturada e índice validado.
- **ProgressRing**: Anel circular com gradientes em arco e animações GSAP fluidas.
- **Chips e Seletores (`.chip`, `.chip-active`)**: Seletores táteis de 42px com cantos suaves (14px) e estado ativo iluminado com glow ciano neon.
- **Botões de Ação (`.btn-primary`)**: Gradiente fluido `linear-gradient(120deg, #5EEAD4 0%, #2DD4BF 45%, #06B6D4 100%)` com texto em alto contraste `#021A1A` e sombra neon.

## Animações e Microinterações (GSAP)

- Stagger fluido na entrada das telas e listas de campanhas.
- Transições de tela elegantes com fade e deslizamento suave.
- Física tátil reativa em todos os botões e seletores.
- Transições no anel de progresso e contadores numéricos de medição.

## Diretrizes

- Mobile-first, otimizado para operação tátil no celular (área de toque mínima de 44px).
- Testado e homologado em viewport móvel ~390px (iPhone / Android moderno).
- Alta legibilidade sob luz solar com contraste otimizado contra o fundo escuro.

Ver também: [[00 - Visão Geral]] · [[01 - Arquitetura]] · [[07 - Changelog]]
