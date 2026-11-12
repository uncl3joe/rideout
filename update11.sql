-- ============================================================
-- ROC Update 11 (v30): Ping-only Discord + 2h-Reminder
-- ------------------------------------------------------------
-- discord_pings verwaltet alle transienten Ping-Nachrichten (Auktionen und
-- Fahrzeughandel), damit der Aufraeum-Job sie nach dem Zeitfenster entfernen kann.
-- Rein additiv. Dieses SQL ZUERST ausfuehren, dann den Code hochladen.
-- Der 48-Stunden-Abholtimer braucht kein SQL (rechnet sich aus ended_at).
-- ============================================================

create table if not exists discord_pings (
  id bigint generated always as identity primary key,
  message_id text not null,
  kind text not null default 'auction',   -- 'auction' oder 'shop' (welcher Webhook)
  ref_id uuid,                              -- zugehoerige Auktion oder Fahrzeug
  created_at timestamptz not null default now()
);
create index if not exists idx_discord_pings_created on discord_pings(created_at);
create index if not exists idx_discord_pings_ref on discord_pings(ref_id);

-- Nur der Service-Role-Zugriff (Server) soll hier lesen/schreiben.
alter table discord_pings enable row level security;

-- 2-Stunden-Reminder fuer Auktionen
alter table auctions add column if not exists reminder_120_sent boolean default false;
alter table auctions add column if not exists reminder_120_msg_id text;
