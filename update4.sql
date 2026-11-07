-- ============================================================
--  RIDE OUT CUSTOMS – Update 4
--  Leserechte fürs Team (Mechaniker, Manager, WL, Inhaber)
--
--  Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
--  Reihenfolge: NACH update3.sql. Mehrmals laufen ist unkritisch.
--
--  Nur LESEN wird freigegeben. Bearbeiten/Löschen läuft weiter über
--  geschützte Server-Actions (nur Inhaber) und ist davon nicht betroffen.
-- ============================================================

-- Team = alle außer Praktikant.
create or replace function is_team() returns boolean
  language sql security definer stable as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('mechaniker', 'manager', 'werkstattleitung', 'inhaber')
  );
$$;

-- Profile (Namen/Ränge) darf das Team lesen – für die Namen in
-- Übersicht, Aufträge, Statistik und Provisionen. Jeder sieht zudem sich selbst.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_team());

-- Aufträge: das Team darf alle lesen (zusätzlich zu bestehenden Regeln,
-- z. B. "eigene Aufträge" für den Praktikanten – die bleiben erhalten).
drop policy if exists orders_select_team on orders;
create policy orders_select_team on orders for select to authenticated
  using (is_team());

-- Auftragspositionen: ebenso fürs Team lesbar (für die Statistik).
drop policy if exists order_items_select_team on order_items;
create policy order_items_select_team on order_items for select to authenticated
  using (is_team());

-- Ausgaben: die Leitungsebene (Manager, WL, Inhaber) darf lesen,
-- damit die Kennzahlen in der Übersicht für sie stimmen. Der Mechaniker
-- bekommt diese Zahlen in der App gar nicht erst angezeigt.
drop policy if exists expenses_select_leitung on expenses;
create policy expenses_select_leitung on expenses for select to authenticated
  using (is_leitung());

-- Provisions-Abrechnung: Leitungsebene sieht alle, der Mechaniker nur die eigene.
drop policy if exists payouts_select on provision_payouts;
create policy payouts_select on provision_payouts for select to authenticated
  using (is_leitung() or mechanic_id = auth.uid());

-- ============================================================
--  FERTIG.
-- ============================================================
