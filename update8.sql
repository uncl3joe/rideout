-- ============================================================
-- ROC Update 8 (v25): Auktions-Erinnerungen + verlaesslicher Takt
-- ------------------------------------------------------------
-- Reihenfolge: dieses SQL ZUERST in Supabase ausfuehren, dann den Code hochladen.
-- Rein additiv, die laufenden Auktionen werden nicht beeintraechtigt.
-- ============================================================

-- 1) Markierungen, damit jede Erinnerung nur EINMAL rausgeht (additiv, gefahrlos)
alter table auctions add column if not exists reminder_60_sent boolean default false;
alter table auctions add column if not exists reminder_15_sent boolean default false;

-- Nachrichten-ID der Fahrzeug-Meldung im Fahrzeughandel-Channel (zum spaeteren Loeschen).
alter table vehicles add column if not exists shop_message_id text;

-- 2) Verlaesslicher 5-Minuten-Takt direkt aus der Datenbank.
--    Ersetzt den unzuverlaessigen GitHub-Takt (der GitHub-Job darf als Notnagel bleiben).

--    Erweiterungen aktivieren (einmalig).
--    Falls eine der beiden Zeilen einen Rechte-Fehler wirft: im Supabase-Dashboard
--    unter Database -> Extensions "pg_cron" und "pg_net" aktivieren und ab Zeile mit
--    cron.unschedule weiterlaufen lassen.
create extension if not exists pg_cron;
create extension if not exists pg_net;

--    Vorhandenen Zeitplan gleichen Namens entfernen (idempotent, damit mehrfaches
--    Ausfuehren keinen doppelten Job anlegt).
select cron.unschedule(jobid) from cron.job where jobname = 'roc-aufraeumer';

--    Alle 5 Minuten den Aufraeum-/Erinnerungs-Endpunkt anstossen.
--    WICHTIG: DEIN_CRON_SECRET durch den echten Wert aus deinen Vercel-Variablen
--    (CRON_SECRET) ersetzen. Ansonsten lehnt der Endpunkt die Anfrage ab.
select cron.schedule(
  'roc-aufraeumer',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://rideout-kappa.vercel.app/api/cron?key=DEIN_CRON_SECRET',
       body := '{}'::jsonb
     ); $$
);

-- Pruefen (optional): zeigt den angelegten Zeitplan.
-- select jobid, jobname, schedule, active from cron.job where jobname = 'roc-aufraeumer';
