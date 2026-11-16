-- ============================================================
-- ROC Update 16 (v38): Fix oeffentliche Team-Seite
-- ------------------------------------------------------------
-- Problem: Die oeffentliche Team-Seite konnte die freigeschalteten Profile
-- nicht zuverlaessig auslesen. Loesung: eine schlanke, oeffentliche Ansicht,
-- die NUR Name, Rang und Foto der freigeschalteten, aktiven Mitarbeiter zeigt.
-- So liest die Seite die Daten genauso oeffentlich wie Shop und Auktion.
-- Zuerst ausfuehren, dann den Code hochladen.
-- ============================================================

create or replace view public_team as
  select name, role, photo_url
  from profiles
  where show_on_team = true
    and active is not false;

-- Oeffentlicher Lesezugriff nur auf diese Ansicht (nicht auf die Profiltabelle).
grant select on public_team to anon, authenticated;
