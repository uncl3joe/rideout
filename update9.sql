-- ============================================================
-- ROC Update 9 (v27): Erinnerungen aufeinander aufräumen
-- ------------------------------------------------------------
-- Merkt sich die Nachrichten-ID der 1-Stunden- und der 15-Minuten-Erinnerung,
-- damit die jeweils vorige gezielt geloescht werden kann.
-- Rein additiv, gefahrlos, die laufenden Auktionen bleiben unberuehrt.
-- Dieses SQL ZUERST in Supabase ausfuehren, dann den Code hochladen.
-- ============================================================

alter table auctions add column if not exists reminder_60_msg_id text;
alter table auctions add column if not exists reminder_15_msg_id text;
