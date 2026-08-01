# 05 - Design

## Conceito

Tema "visor de medidor" — água / hidrômetro. Glassmorphism sobre fundo escuro com manchas de luz.

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--ocean` | `#071822` | fundo oceano escuro |
| `--cyan` | `#5eead4` | acentos, destaques |
| — | glass | cards com `backdrop-filter: blur()`, bordas translúcidas, brilho (sheen) |

## Tipografia

| Fonte | Uso |
|---|---|
| **Unbounded** | display / títulos |
| **Outfit** | texto corrido / corpo |
| **JetBrains Mono** | códigos de apartamento |

## Componentes visuais

- **GlassCard** — card com blur, borda translúcida, sheen.
- **ProgressRing** — anel de progresso animado.
- **AptButton** — botão de apartamento com estado (vazio | foto | foto+índice).
- **Background** — manchas de luz (água) no fundo.

## Animações (GSAP)

- Stagger de entrada dos elementos.
- Transições entre telas (troca de screen).
- Anel de progresso animado.
- "Pop" em contadores (fotos/índices).

## Diretrizes

- Mobile-first, touch-friendly.
- Testar em viewport ~390px.
- Fonte legível, alvos de toque generosos.

Ver também: [[00 - Visão Geral]] · [[01 - Arquitetura]]
