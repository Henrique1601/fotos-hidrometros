# 03 - Banco de Dados Local

Dexie sobre IndexedDB. Banco: `fotos-hidrometros`, versão 1.

## Tabelas

### campaigns

```ts
interface Campaign {
  id: string;
  name: string;        // ex: "Julho 2026"
  month: number;       // 1-12
  year: number;
  createdAt: number;   // timestamp
  status: 'collecting' | 'indexing' | 'done';
}
```

### records

```ts
interface Record {
  id: string;
  campaignId: string;
  towerId: string;      // "A".."H"
  floor: number;        // 3..25
  unit: number;         // 1..8
  side: 'left' | 'right';
  aptCode: string;      // String(floor*10+unit) → "31", "101", "258"
  photo?: Blob;
  index?: number | null;
  capturedAt?: number;
  indexedAt?: number;
}
```

## Índices

- `records`: composto único `[campaignId + towerId + aptCode]` — garante 1 registro por ap por torre por campanha.
- `records.campaignId` + `towerId` para queries por campanha/torre.
- `campaigns.createdAt` para ordenação.

## Upsert (refotografia)

`upsertRecord` grava/atualiza o registro **preservando o índice já preenchido** quando o ap é refotografado (novo Blob substitui o antigo, índice permanece).

## Uso no app

- `useLiveQuery` (dexie-react-hooks) para reatividade nas telas.
- Fotos são Blobs — `usePhotoUrl` converte para ObjectURL e revoga ao desmontar.

## Sincronização e Nuvem (Supabase PostgreSQL)

O app possui arquitetura **Offline-First com Nuvem Híbrida**:
- **Localmente**: IndexedDB (Dexie) garante operação em campo sem sinal de internet.
- **Backup Manual JSON**: Permite arquivar medições em arquivos compactos com filtros de período e tipo de dados (tudo, índices, fotos).
- **Nuvem Supabase**: Sincroniza tabelas remotas (`campaigns` e `records`) com PostgreSQL e autenticação segura via Row Level Security (RLS) por usuário (`auth.uid()`).
  - Sincronização bidirecional via `sync.ts` (`pushAll`, `pullAll`, `syncAll`) com resolução de conflitos por *Last-Write-Wins* (`updatedAt`).

Ver também: [[01 - Arquitetura]] · [[00 - Visão Geral]] · [[07 - Changelog]]

