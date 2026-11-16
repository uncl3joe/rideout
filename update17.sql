-- ============================================================
-- ROC Update 17 (v41): Bieter-Check per IP und Browser-Kennung
-- ------------------------------------------------------------
-- Rein additiv. Zuerst ausfuehren, dann den Code hochladen.
-- Ab dem Einspielen wird bei jedem neuen Gebot die IP (serverseitig) und eine
-- anonyme Browser-Kennung mitgespeichert, damit der Bieter-Check auch
-- Namenswechsel bei gleicher IP oder gleichem Browser erkennt.
-- Fuer bereits vorhandene Gebote bleiben diese Felder leer.
-- ============================================================

alter table bid_contacts add column if not exists ip     text;
alter table bid_contacts add column if not exists device text;
