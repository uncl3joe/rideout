-- ============================================================
-- ROC Update 18 (v42): Tauschbörse (Auto gegen Auto)
-- ------------------------------------------------------------
-- Öffentliche Tauschbörse: Besucher stellen selbst ein Inserat ein
-- (Vor-/Nachname, Telefon, angebotenes Fahrzeug + Foto, gesuchtes
-- Fahrzeug als Text + optional Foto). Inserate laufen 30 Tage und
-- werden danach automatisch nicht mehr angezeigt. Die Leitung kann
-- Inserate jederzeit entfernen.
--
-- Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
-- Reihenfolge: NACH vehicles.sql (Bucket 'vehicles' muss existieren).
-- Darf gefahrlos mehrmals laufen.
-- ============================================================

-- ---------- 1) Tabelle ----------
create table if not exists trade_listings (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days'),
  first_name  text        not null,
  last_name   text        not null,
  phone       text        not null,
  offer_model text        not null,        -- angebotenes Fahrzeug (Bezeichnung)
  offer_image text,                        -- Foto des angebotenen Fahrzeugs
  seek_text   text        not null,        -- gesuchtes Fahrzeug (Freitext)
  seek_image  text,                        -- optionales Foto des gesuchten Fahrzeugs
  removed     boolean     not null default false
);
create index if not exists idx_trade_active on trade_listings(removed, expires_at);

alter table trade_listings enable row level security;
-- Bewusst KEINE öffentliche Lese-/Schreib-Policy auf der Tabelle:
--   Schreiben läuft serverseitig über den Service-Key (Server-Action),
--   Lesen läuft über die öffentliche Ansicht public_trades unten.

-- ---------- 2) Öffentliche Ansicht ----------
-- Zeigt nur aktive, nicht abgelaufene Inserate. Genauso öffentlich lesbar
-- wie Shop, Auktion und Team (public_team).
create or replace view public_trades as
  select id, first_name, last_name, phone, offer_model, offer_image,
         seek_text, seek_image, created_at, expires_at
  from trade_listings
  where removed = false
    and expires_at > now();

grant select on public_trades to anon, authenticated;

-- ---------- 3) Foto-Upload für Inserenten (ohne Login) ----------
-- Besucher dürfen Fotos NUR in den Unterordner 'tausch/' des bestehenden,
-- öffentlich lesbaren Buckets 'vehicles' legen. Lesen ist bereits öffentlich
-- (Policy vehicles_obj_read), Ändern/Löschen bleibt der Leitung vorbehalten.
drop policy if exists "tausch_obj_insert" on storage.objects;
create policy "tausch_obj_insert" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'vehicles'
    and (storage.foldername(name))[1] = 'tausch'
  );

-- ============================================================
--  FERTIG. Danach den Code hochladen (v42).
-- ============================================================
