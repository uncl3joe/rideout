-- ============================================================
--  RIDE OUT CUSTOMS – Update 7
--  Beendete/gelöschte Auktionen aus dem Discord-Channel aufräumen
--
--  Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
--  Reihenfolge: NACH update6.sql. Mehrmals laufen ist unkritisch.
-- ============================================================

alter table auctions add column if not exists ended_at               timestamptz;
alter table auctions add column if not exists discord_end_message_id text;

-- Bereits beendete Auktionen bekommen eine Endzeit, damit auch sie nach
-- einer Stunde aus dem Channel verschwinden.
update auctions set ended_at = now() where status = 'ended' and ended_at is null;

-- FERTIG.
