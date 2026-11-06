-- ============================================================
--  RIDE OUT CUSTOMS – Update 3
--  Rechte, Auftrags-Bearbeitung, Mitarbeiter-Status & Provisionen
--
--  Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
--  Reihenfolge: NACH dem Haupt-Schema und nach vehicles.sql.
--  Darf gefahrlos mehrmals laufen (alles IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ---------- 1) Helfer: is_inhaber() sicherstellen ----------
create or replace function is_inhaber() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'inhaber');
$$;

-- ---------- 2) Mitarbeiter: Provisionssatz + Status ----------
-- provision_rate: Anteil vom Reingewinn (0.30 = 30 %). Pro Mechaniker einstellbar.
-- active:  false = deaktiviert (Login gesperrt, kommt zurück, Zahlen bleiben)
-- archived: true = per "Löschen" zum Platzhalter geworden (endgültig, Zahlen bleiben)
alter table profiles add column if not exists provision_rate numeric  not null default 0.30;
alter table profiles add column if not exists active         boolean  not null default true;
alter table profiles add column if not exists archived       boolean  not null default false;

-- ---------- 3) Auftrag: Mechaniker-Name als Schnappschuss ----------
-- Damit die Zahlen auch dann stehen bleiben, wenn ein Mitarbeiter
-- irgendwann ganz verschwindet. Bestehende Aufträge werden einmalig befüllt.
alter table orders add column if not exists mechanic_name text;
update orders o
   set mechanic_name = p.name
  from profiles p
 where o.mechanic_id = p.id
   and (o.mechanic_name is null or o.mechanic_name = '');

-- ---------- 4) Provisions-Abrechnung (Bonus + ausbezahlt) ----------
-- Eine Zeile je Mechaniker und Kalenderwoche. Die Basis-Provision kommt
-- live aus den Aufträgen; hier stehen nur Bonus/Sonderzahlung und ob
-- die Woche schon ausbezahlt wurde.
create table if not exists provision_payouts (
  id          uuid        primary key default gen_random_uuid(),
  mechanic_id uuid        references profiles(id) on delete cascade,
  period_key  text        not null,            -- z. B. '2026-W45'
  bonus       integer     not null default 0,  -- Sonderzahlung in $
  paid        boolean     not null default false,
  paid_at     timestamptz,
  note        text        not null default '',
  updated_at  timestamptz not null default now(),
  unique (mechanic_id, period_key)
);
create index if not exists idx_payouts_period on provision_payouts(period_key);

alter table provision_payouts enable row level security;

-- Lesen nur Inhaber. Schreiben läuft serverseitig über den Service-Key
-- (umgeht RLS); bewusst KEINE insert/update-Policy = für normale Clients gesperrt.
drop policy if exists payouts_select on provision_payouts;
create policy payouts_select on provision_payouts for select to authenticated
  using (is_inhaber());

-- ============================================================
--  FERTIG. Bearbeiten/Löschen von Aufträgen, Ausgaben und Verträgen
--  sowie Deaktivieren/Löschen von Mitarbeitern laufen in der App über
--  geschützte Server-Actions (nur Inhaber). Es sind dafür KEINE weiteren
--  Schreib-Policies nötig – ohne Policy sind diese Aktionen für normale
--  Browser-Clients ohnehin gesperrt (RLS = standardmäßig "deny").
-- ============================================================
