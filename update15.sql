-- ============================================================
-- ROC Update 15 (v37): Oeffentliche Startseite + Team-Seite
-- ------------------------------------------------------------
-- Rein additiv. Zuerst ausfuehren, dann den Code hochladen.
--
-- Profile bekommen zwei Felder fuer die oeffentliche Team-Seite:
--  - show_on_team: ob die Person auf der oeffentlichen Seite erscheint
--    (wird von der Leitung gesetzt, Standard aus)
--  - photo_url: optionales Foto (nur Leitung laedt hoch)
-- ============================================================

alter table profiles add column if not exists show_on_team boolean not null default false;
alter table profiles add column if not exists photo_url    text;
