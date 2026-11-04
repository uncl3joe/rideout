-- ============================================================
--  RIDE OUT CUSTOMS – Phase 3: Fahrzeughandel
--  Tabellen für Fahrzeuge + Reservierungen, Rechte (RLS) und
--  der Foto-Speicher (Storage-Bucket) – alles in einem Schritt.
--
--  Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
--  Setzt das Haupt-Schema (profiles, is_leitung() …) voraus.
-- ============================================================

do $$ begin
  create type vehicle_status as enum ('verfuegbar','reserviert','verkauft');
exception when duplicate_object then null; end $$;

-- ---------- Fahrzeuge ----------
create table if not exists vehicles (
  id          uuid primary key default gen_random_uuid(),
  model       text           not null,
  price       integer        not null default 0,   -- Verhandlungspreis
  seller_id   uuid           references profiles(id) on delete set null,
  seller_name text           not null default '',   -- für die öffentliche Anzeige (kein Login nötig)
  status      vehicle_status not null default 'verfuegbar',
  image_url   text,
  created_at  timestamptz    not null default now(),
  updated_at  timestamptz    not null default now()
);
create index if not exists idx_vehicles_status on vehicles(status);
create index if not exists idx_vehicles_created on vehicles(created_at);

-- ---------- Reservierungen ----------
create table if not exists reservations (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid references vehicles(id) on delete cascade,
  customer_name   text not null default '',
  customer_contact text not null default '',
  handled         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_reservations_vehicle on reservations(vehicle_id);

drop trigger if exists trg_vehicles_updated on vehicles;
create trigger trg_vehicles_updated before update on vehicles
  for each row execute function set_updated_at();

-- ============================================================
--  RECHTE (RLS)
-- ============================================================
alter table vehicles     enable row level security;
alter table reservations enable row level security;

-- Damit die Leitungsebene (inkl. Manager) im Autohandel das Verkäufer-Feld
-- mit Team-Namen füllen kann: Team-Lesen auf Leitungsebene erweitern.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_leitung());

-- Fahrzeuge: JEDER darf lesen (öffentliche Kundenseite, auch ohne Login);
-- nur die Leitungsebene legt an / ändert / löscht.
drop policy if exists vehicles_read on vehicles;
create policy vehicles_read on vehicles for select to anon, authenticated using (true);

drop policy if exists vehicles_write on vehicles;
create policy vehicles_write on vehicles for all to authenticated
  using (is_leitung()) with check (is_leitung());

-- Reservierungen: Kunden (auch ohne Login) dürfen eine ANLEGEN;
-- lesen/verwalten darf nur die Leitungsebene.
drop policy if exists reservations_insert on reservations;
create policy reservations_insert on reservations for insert to anon, authenticated
  with check (true);

drop policy if exists reservations_select on reservations;
create policy reservations_select on reservations for select to authenticated
  using (is_leitung());

drop policy if exists reservations_modify on reservations;
create policy reservations_modify on reservations for update to authenticated
  using (is_leitung()) with check (is_leitung());

drop policy if exists reservations_delete on reservations;
create policy reservations_delete on reservations for delete to authenticated
  using (is_leitung());

-- ============================================================
--  FOTO-SPEICHER (Storage-Bucket 'vehicles', öffentlich lesbar)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('vehicles','vehicles', true)
on conflict (id) do update set public = true;

drop policy if exists "vehicles_obj_read"   on storage.objects;
create policy "vehicles_obj_read" on storage.objects for select to public
  using (bucket_id = 'vehicles');

drop policy if exists "vehicles_obj_insert" on storage.objects;
create policy "vehicles_obj_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicles' and is_leitung());

drop policy if exists "vehicles_obj_update" on storage.objects;
create policy "vehicles_obj_update" on storage.objects for update to authenticated
  using (bucket_id = 'vehicles' and is_leitung());

drop policy if exists "vehicles_obj_delete" on storage.objects;
create policy "vehicles_obj_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'vehicles' and is_leitung());
