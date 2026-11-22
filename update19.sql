-- ============================================================
-- ROC Update 19 (v43): Bieter-Sperren (Ban-Liste)
-- ------------------------------------------------------------
-- Sperrliste fuer Auktionsgebote. Ein gesperrter IC-Name, Discord-Name,
-- eine gesperrte IP oder Browser-Kennung kann kein Gebot mehr abgeben.
-- Verwaltet wird die Liste im Bieter-Check (nur Leitung).
--
-- Einspielen: Supabase -> SQL Editor -> komplette Datei -> "Run".
-- Rein additiv, darf gefahrlos mehrmals laufen.
-- ============================================================

create table if not exists bid_bans (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text        not null check (kind in ('ic', 'discord', 'ip', 'device')),
  value       text        not null,   -- normalisiert (ic/discord klein geschrieben)
  reason      text,                    -- optionaler Grund
  created_by  text,                    -- Name der Leitung, die gesperrt hat
  unique (kind, value)
);
create index if not exists idx_bid_bans_lookup on bid_bans(kind, value);

alter table bid_bans enable row level security;
-- Bewusst KEINE oeffentliche Policy: Lesen und Schreiben laufen ausschliesslich
-- ueber die geschuetzten Server-Actions (Service-Key, nur Leitung).

-- ============================================================
--  FERTIG. Danach den Code hochladen (v43).
-- ============================================================
