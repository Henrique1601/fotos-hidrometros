-- Schema para sync do Fotos Hidrômetros (Supabase / Postgres)
-- Rode no SQL Editor do seu projeto Supabase.

create table if not exists public.campaigns (
  client_id bigint primary key,
  user_id uuid not null default auth.uid(),
  name text,
  month integer not null,
  year integer not null,
  created_at bigint not null,
  updated_at bigint not null,
  status text not null default 'collecting'
);

create table if not exists public.records (
  campaign_client_id bigint not null references public.campaigns (client_id) on delete cascade,
  user_id uuid not null default auth.uid(),
  apt_code text not null,
  tower_id text not null,
  floor integer not null,
  unit integer not null,
  side text not null,
  index_value numeric,
  captured_at bigint,
  indexed_at bigint,
  updated_at bigint not null,
  photo_base64 text,
  photo_type text,
  primary key (campaign_client_id, apt_code, user_id)
);

create index if not exists records_updated_at_idx on public.records (updated_at);
create index if not exists campaigns_updated_at_idx on public.campaigns (updated_at);

-- RLS: só o dono autenticado acessa.
alter table public.campaigns enable row level security;
alter table public.records enable row level security;

create policy "owner campaigns" on public.campaigns
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner records" on public.records
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
