-- ============================================================
-- ROC Update 14 (v36): Mitarbeiter-Regeln (Leitfaden)
-- ------------------------------------------------------------
-- Rein additiv. Dieses SQL ZUERST ausfuehren, dann den Code hochladen.
--
-- - rules_doc: EIN editierbares Regel-Dokument (als JSON) mit Versionsnummer.
--   Aendert der Inhaber die Regeln und erhoeht die Version, muessen alle erneut
--   bestaetigen.
-- - rules_acceptances: Protokoll, wer welche Version wann bestaetigt hat.
-- Zugriff laeuft komplett ueber Server-Actions (Service-Role), darum RLS an,
-- ohne weitere Policies.
-- ============================================================

create table if not exists rules_doc (
  id         int primary key default 1,
  version    int not null default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null,
  constraint rules_doc_singleton check (id = 1)
);

create table if not exists rules_acceptances (
  profile_id  uuid not null references profiles(id) on delete cascade,
  version     int not null,
  accepted_at timestamptz not null default now(),
  primary key (profile_id, version)
);

alter table rules_doc         enable row level security;
alter table rules_acceptances enable row level security;
