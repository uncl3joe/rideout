-- ============================================================
-- ROC Update 12 (v33): Werkstatt-Abgleich (JSON-Import als Wahrheit)
-- ------------------------------------------------------------
-- Rein additiv. Dieses SQL ZUERST im Supabase SQL-Editor ausfuehren,
-- dann den Code hochladen.
--
-- Idee: Das JSON-Export vom Werkstattskript ist die Wahrheit. Beim Import
-- werden die abgerechneten Auftraege als orders (source='script') angelegt,
-- entdoppelt ueber die eindeutige Auftragsnummer. Die Hand-Eintraege der
-- Mechaniker im importierten Zeitraum werden als "ersetzt" (superseded)
-- markiert, damit die Provisionen nicht doppelt zaehlen.
-- ============================================================

-- 1) orders bekommt Herkunft, "ersetzt"-Markierung und die Skript-Auftragsnummer.
alter table orders add column if not exists source         text    not null default 'manual';
alter table orders add column if not exists superseded     boolean not null default false;
alter table orders add column if not exists script_auftrag bigint;

-- Jede Skript-Auftragsnummer darf hoechstens einmal als order existieren
-- (das ist die harte Entdoppelung ueber mehrere, auch ueberlappende Importe).
create unique index if not exists orders_script_auftrag_uq
  on orders(script_auftrag) where script_auftrag is not null;

-- 2) Material pro Arbeitsschritt (Schritt-Name -> Materialwert).
--    Wird beim Import aus dem Katalog vorbefuellt, Rest traegt die Inhaberin nach.
create table if not exists step_materials (
  schritt    text primary key,
  material   numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- 3) Bestaetigte Namenszuordnungen (JSON-Mechanikername -> Profil).
--    alias_norm ist der normalisierte Name (klein, Mehrfach-Leerzeichen zu einem).
create table if not exists mechanic_aliases (
  alias_norm text primary key,
  alias_label text,
  mechanic_id uuid references profiles(id) on delete cascade,
  updated_at  timestamptz not null default now()
);

-- 4) Import-Protokoll (welcher Zeitraum, wann, wie viele Auftraege).
create table if not exists script_imports (
  id           bigint generated always as identity primary key,
  period_start date,
  period_end   date,
  jobs_total   int,
  jobs_imported int,
  jobs_skipped int,
  imported_by  uuid references profiles(id) on delete set null,
  imported_at  timestamptz not null default now()
);

-- Nur der Server (Service-Role) liest/schreibt diese Tabellen.
alter table step_materials   enable row level security;
alter table mechanic_aliases enable row level security;
alter table script_imports   enable row level security;
