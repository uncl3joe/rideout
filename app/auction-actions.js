'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';
import { effectiveEndMs } from '@/lib/cleanup';
import { buildAuctionEmbed, postAuctionMessage, refreshAuctionMessage, finalizeAuctionMessages, deleteAuctionMessages } from '@/lib/auction-discord';

const MIN_INCREMENT = 50000;
const dollars = (n) => Number(n || 0).toLocaleString('de-DE') + ' $';

// ---------------- Öffentlich: Gebot abgeben ----------------
export async function placeBid({ auctionId, icName, discordName, amount }) {
  icName = String(icName || '').trim();
  discordName = String(discordName || '').trim();
  amount = Math.round(Number(amount) || 0);
  if (!auctionId || !icName || !discordName) return { ok: false, error: 'Bitte IC-Name und Discord-Name angeben.' };
  if (icName.length > 60 || discordName.length > 60) return { ok: false, error: 'Eingabe zu lang.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Server ist nicht konfiguriert.' };

  const { data: a } = await admin.from('auctions').select('*').eq('id', auctionId).single();
  if (!a) return { ok: false, error: 'Auktion nicht gefunden.' };
  if (a.status !== 'live' || Date.now() >= effectiveEndMs(a)) return { ok: false, error: 'Diese Auktion ist bereits beendet.' };

  const minNext = a.current_bid != null ? a.current_bid + a.min_increment : a.start_price;
  if (amount < minNext) return { ok: false, error: 'Mindestens ' + dollars(minNext) + ' nötig.', min: minNext };

  const nowIso = new Date().toISOString();
  const { data: bid, error: be } = await admin
    .from('bids')
    .insert({ auction_id: auctionId, ic_name: icName, amount })
    .select('id')
    .single();
  if (be || !bid) return { ok: false, error: 'Gebot fehlgeschlagen.' };

  await admin.from('bid_contacts').insert({ bid_id: bid.id, auction_id: auctionId, discord_name: discordName });
  await admin.from('auctions').update({ current_bid: amount, current_bid_ic: icName, last_bid_at: nowIso }).eq('id', auctionId);

  await refreshAuctionMessage(admin, auctionId); // Live-Nachricht in Discord aktualisieren

  return { ok: true, amount };
}

// ---------------- Backend (Leitung) ----------------
export async function createAuction({ model, imageUrl, startPrice, minIncrement, endsAt, sellerId, customerName }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };

  model = String(model || '').trim();
  if (!model) return { ok: false, error: 'Modell angeben.' };
  const ends = new Date(endsAt);
  if (!endsAt || isNaN(ends.getTime()) || ends.getTime() <= Date.now()) {
    return { ok: false, error: 'Ablaufzeit muss in der Zukunft liegen.' };
  }

  // Anbieter bestimmen: entweder ein Kundenfahrzeug (freier Name, kein seller_id)
  // oder das Fahrzeug eines Teammitglieds (seller_id + Name aus dem Profil).
  const cust = String(customerName || '').trim();
  let seller_id = null;
  let seller_name = '';
  if (cust) {
    if (cust.length > 60) return { ok: false, error: 'Kundenname zu lang.' };
    seller_name = cust;
  } else {
    const pid = sellerId || chk.user.id;
    const { data: prof } = await admin.from('profiles').select('name').eq('id', pid).single();
    seller_id = pid;
    seller_name = prof?.name || '';
  }

  const { data: a, error } = await admin
    .from('auctions')
    .insert({
      model,
      image_url: imageUrl || null,
      start_price: Math.max(0, Math.round(Number(startPrice) || 0)),
      min_increment: Math.max(MIN_INCREMENT, Math.round(Number(minIncrement) || MIN_INCREMENT)),
      ends_at: ends.toISOString(),
      status: 'live',
      seller_id,
      seller_name,
    })
    .select('id, model, image_url, start_price, min_increment, current_bid, current_bid_ic, last_bid_at, ends_at, status')
    .single();
  if (error) return { ok: false, error: error.message };

  // Öffentliche Live-Nachricht in Discord posten und die Nachrichten-ID merken.
  const mid = await postAuctionMessage(buildAuctionEmbed(a, [], false));
  if (mid) await admin.from('auctions').update({ discord_message_id: mid }).eq('id', a.id);

  return { ok: true, id: a.id };
}

export async function endAuction({ auctionId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!auctionId) return { ok: false, error: 'Keine Auktion gewählt.' };

  const { data: a } = await admin.from('auctions').select('*').eq('id', auctionId).single();
  if (!a) return { ok: false, error: 'Auktion nicht gefunden.' };
  if (a.status === 'ended') return { ok: true };

  const { data: upd } = await admin
    .from('auctions')
    .update({ status: 'ended', winner_ic: a.current_bid_ic || null, ended_at: new Date().toISOString() })
    .eq('id', auctionId)
    .eq('status', 'live')
    .select('id');
  if (upd && upd.length) {
    await finalizeAuctionMessages(admin, auctionId);
  }
  return { ok: true };
}

export async function deleteBid({ bidId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!bidId) return { ok: false, error: 'Kein Gebot gewählt.' };

  const { data: b } = await admin.from('bids').select('id, auction_id').eq('id', bidId).single();
  if (!b) return { ok: false, error: 'Gebot nicht gefunden.' };

  await admin.from('bid_contacts').delete().eq('bid_id', bidId);
  await admin.from('bids').delete().eq('id', bidId);

  // Höchstgebot + letzten Gebotszeitpunkt neu bestimmen.
  const { data: rest } = await admin.from('bids').select('ic_name, amount, created_at').eq('auction_id', b.auction_id);
  let top = null;
  let latest = null;
  for (const r of rest || []) {
    if (!top || r.amount > top.amount) top = r;
    if (!latest || new Date(r.created_at) > new Date(latest.created_at)) latest = r;
  }
  await admin
    .from('auctions')
    .update({
      current_bid: top ? top.amount : null,
      current_bid_ic: top ? top.ic_name : null,
      last_bid_at: latest ? latest.created_at : null,
    })
    .eq('id', b.auction_id);

  await refreshAuctionMessage(admin, b.auction_id);

  return { ok: true };
}

export async function deleteAuction({ auctionId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!auctionId) return { ok: false, error: 'Keine Auktion gewählt.' };
  // Erst die Discord-Nachrichten entfernen, dann die Auktion löschen.
  const { data: a } = await admin.from('auctions').select('discord_message_id, discord_end_message_id').eq('id', auctionId).single();
  if (a) await deleteAuctionMessages(a);
  const { error } = await admin.from('auctions').delete().eq('id', auctionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
