-- UHC Statistikrechner – Datenbank-Schema
-- Im Supabase Dashboard unter "SQL Editor → New query" einfügen und "Run" klicken.
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.

-- ============================================================
-- 1) HIER DEINE ADMIN-E-MAIL EINTRAGEN (zweimal, ganz unten)
-- ============================================================

-- Spieler (Kader)
create table if not exists public.players (
  id          uuid primary key,
  name        text not null,
  number      int,
  position    text check (position in ('S', 'V', 'G')),  -- Stürmer, Verteidiger, Goalie
  active      boolean not null default true,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Matches
create table if not exists public.matches (
  id          uuid primary key,
  date        date not null,
  opponent    text not null,
  home        boolean not null default true,
  season      text not null,                     -- z.B. "2026/27"
  roster      uuid[] not null default '{}',      -- Aufgebot
  lines       jsonb not null default '[]',       -- [[spieler-id, ...], ...]
  notes       text,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Ereignisse während eines Matches
create table if not exists public.events (
  id              uuid primary key,
  match_id        uuid not null references public.matches (id),
  type            text not null check (type in ('goal_for', 'goal_against', 'penalty')),
  period          int,
  game_time       text,
  scorer_id       uuid,
  assist_id       uuid,
  on_ice          uuid[] not null default '{}',  -- Feldspieler auf dem Feld (für +/-)
  player_id       uuid,                          -- bestrafter Spieler
  penalty         text,                          -- '2', '2+2', '5', '10', 'MS'
  deleted         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists events_match_id_idx on public.events (match_id);

-- Spiel-ID bei swiss unihockey (z.B. "su:1106069") – vom Spielplan-Import gesetzt,
-- damit ein erneuter Import keine Duplikate anlegt.
alter table public.matches add column if not exists external_id text unique;

-- ============================================================
-- Zugriffsrechte (Row Level Security)
-- Nur eingeloggte Benutzer (Team-Login / Admin) sehen Daten.
-- Den Kader ändern darf nur der Admin.
-- ============================================================

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.events  enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

drop policy if exists "players lesen"   on public.players;
drop policy if exists "players ändern"  on public.players;
drop policy if exists "matches alles"   on public.matches;
drop policy if exists "events alles"    on public.events;

create policy "players lesen"  on public.players for select to authenticated using (true);
create policy "players ändern" on public.players for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "matches alles"  on public.matches for all    to authenticated using (true) with check (true);
create policy "events alles"   on public.events  for all    to authenticated using (true) with check (true);

-- Anonyme Zugriffe komplett sperren
revoke all on public.players, public.matches, public.events from anon;
grant select, insert, update on public.players, public.matches, public.events to authenticated;

-- Ping für die Keep-Alive-Action (verhindert, dass das Gratis-Projekt pausiert).
-- Liefert nur die aktuelle Uhrzeit, keine Daten.
create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function public.ping() to anon;

-- ============================================================
-- Admin-Rolle vergeben – E-Mail anpassen!
-- (Nach dem Ausführen einmal in der App ab- und wieder anmelden.)
-- ============================================================

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'DEINE-ADMIN-EMAIL@example.com';

-- Kontrolle: sollte genau eine Zeile mit role = admin zeigen
select email, raw_app_meta_data ->> 'role' as role
from auth.users
where email = 'DEINE-ADMIN-EMAIL@example.com';
