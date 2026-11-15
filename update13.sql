-- ============================================================
-- ROC Update 13 (v35): Zeitstempel + Kennzeichen beim Import behalten
-- ------------------------------------------------------------
-- Rein additiv. Dieses SQL ZUERST ausfuehren, dann den Code hochladen,
-- und danach den 7-Tage-Export EINMAL erneut importieren, damit die schon
-- importierten Auftraege ihre echte Uhrzeit und das Kennzeichen bekommen.
-- ============================================================

-- Echter Zeitstempel aus dem Skript (Rohtext "YYYY-MM-DD HH:MM", nur fuer Import-
-- Auftraege) und das Kennzeichen. Bei Hand-Eintraegen bleiben beide leer.
alter table orders add column if not exists event_at    text;
alter table orders add column if not exists kennzeichen text;

-- Eindeutigkeit der Skript-Auftragsnummer von "partiell" auf "normal" umstellen,
-- damit der Import per Upsert entweder einfuegen ODER aktualisieren kann
-- (bestehende Auftraege werden so mit Uhrzeit/Kennzeichen nachgezogen, ohne Dubletten).
-- Mehrere NULL-Werte (Hand-Eintraege) bleiben erlaubt.
drop index if exists orders_script_auftrag_uq;
create unique index if not exists orders_script_auftrag_uq on orders(script_auftrag);
