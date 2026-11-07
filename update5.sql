-- ============================================================
--  RIDE OUT CUSTOMS – Update 5
--  24-Stunden-Reservierung + Live-Auktion
--
--  Einspielen: Supabase → SQL Editor → komplette Datei → "Run".
--  Reihenfolge: NACH update4.sql. Mehrmals laufen ist unkritisch.
-- ============================================================

-- ---------- 1) 24-Stunden-Reservierung ----------
alter table vehicles     add column if not exists reserve_24h        boolean not null default false;
alter table reservations add column if not exists expires_at         timestamptz;
alter table reservations add column if not exists discord_message_id text;
create index if not exists idx_reservations_expires on reservations(expires_at);

-- ---------- 2) Auktionen ----------
create table if not exists auctions (
  id             uuid primary key default gen_random_uuid(),
  model          text        not null,
  image_url      text,
  start_price    integer     not null default 0,
  min_increment  integer     not null default 1000,
  current_bid    integer,                       -- aktuelles Höchstgebot (null = noch keins)
  current_bid_ic text,                          -- IC-Name des Höchstbieters (öffentlich)
  last_bid_at    timestamptz,                   -- für die 30-Sekunden-Nachfrist
  ends_at        timestamptz not null,          -- geplantes Ende
  status         text        not null default 'live',  -- 'live' | 'ended'
  winner_ic      text,
  seller_id      uuid references profiles(id) on delete set null,
  seller_name    text        not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_auctions_status on auctions(status);

-- Gebote: ÖFFENTLICH lesbar – bewusst OHNE Discord-Name (nur IC + Betrag).
create table if not exists bids (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid references auctions(id) on delete cascade,
  ic_name     text    not null,
  amount      integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bids_auction on bids(auction_id);

-- Discord-Namen der Bieter getrennt – nur die Leitungsebene liest das.
create table if not exists bid_contacts (
  id           uuid primary key default gen_random_uuid(),
  bid_id       uuid references bids(id) on delete cascade,
  auction_id   uuid references auctions(id) on delete cascade,
  discord_name text not null default '',
  created_at   timestamptz not null default now()
);

alter table auctions     enable row level security;
alter table bids         enable row level security;
alter table bid_contacts enable row level security;

-- Auktionen + Gebote: jeder darf lesen (öffentliche Seite). Schreiben nur
-- über die Server-Actions (Service-Key) – daher KEINE Insert/Update-Policy.
drop policy if exists auctions_read on auctions;
create policy auctions_read on auctions for select to anon, authenticated using (true);

drop policy if exists bids_read on bids;
create policy bids_read on bids for select to anon, authenticated using (true);

-- Discord-Namen: nur Leitungsebene.
drop policy if exists bid_contacts_read on bid_contacts;
create policy bid_contacts_read on bid_contacts for select to authenticated using (is_leitung());

-- ---------- 3) Realtime (Live-Gebote) ----------
alter table bids     replica identity full;
alter table auctions replica identity full;
do $$ begin alter publication supabase_realtime add table bids;     exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table auctions; exception when duplicate_object then null; end $$;

-- ============================================================
--  FERTIG. Fotos der Auktionen nutzen denselben Storage-Bucket
--  'vehicles' wie der Fahrzeughandel (ist bereits öffentlich).
-- ============================================================
