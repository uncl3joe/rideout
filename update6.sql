-- ============================================================
--  RIDE OUT CUSTOMS – Update 6
--  Discord-Nachrichten-ID je Auktion (für die Live-Nachricht)
--
--  Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
--  Reihenfolge: NACH update5.sql. Mehrmals laufen ist unkritisch.
-- ============================================================

alter table auctions add column if not exists discord_message_id text;

-- FERTIG. Für die öffentliche Auktions-Benachrichtigung in Vercel zusätzlich
-- die Umgebungsvariable DISCORD_AUCTION_WEBHOOK (eigener Discord-Webhook)
-- eintragen. Ohne sie laufen Auktionen normal, nur ohne Discord-Posts.
