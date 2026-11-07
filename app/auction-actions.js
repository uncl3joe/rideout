'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';
import { effectiveEndMs } from '@/lib/cleanup';

async function postDiscord(embed) {
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return;
  try {
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch {
    /* optional */
  }
}

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

  return { ok: true, amount };
}

// ---------------- Backend (Leitung) ----------------
export async function createAuction({ model, imageUrl, startPrice, minIncrement, endsAt }) {
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

  const { data: prof } = await admin.from('profiles').select('name').eq('id', chk.user.id).single();
  const { data: a, error } = await admin
    .from('auctions')
    .insert({
      model,
      image_url: imageUrl || null,
      start_price: Math.max(0, Math.round(Number(startPrice) || 0)),
      min_increment: Math.max(1, Math.round(Number(minIncrement) || 1000)),
      ends_at: ends.toISOString(),
      status: 'live',
      seller_id: chk.user.id,
      seller_name: prof?.name || '',
    })
    .select('id, model, start_price, ends_at')
    .single();
  if (error) return { ok: false, error: error.message };

  await postDiscord({
    title: '🔨 Neue Auktion gestartet',
    color: 0xff7a1a,
    fields: [
      { name: 'Fahrzeug', value: String(a.model), inline: true },
      { name: 'Startpreis', value: dollars(a.start_price), inline: true },
      { name: 'Ende', value: new Date(a.ends_at).toLocaleString('de-DE'), inline: true },
    ],
    footer: { text: 'Ride Out Customs · Auktion' },
    timestamp: new Date().toISOString(),
  });

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
    .update({ status: 'ended', winner_ic: a.current_bid_ic || null })
    .eq('id', auctionId)
    .eq('status', 'live')
    .select('id');
  if (upd && upd.length) {
    await postDiscord({
      title: '🏁 Auktion beendet',
      color: 0x37a6ea,
      fields: [
        { name: 'Fahrzeug', value: String(a.model || '—'), inline: true },
        { name: 'Gewinner', value: a.current_bid_ic ? String(a.current_bid_ic) : 'Kein Gebot', inline: true },
        { name: 'Gebot', value: a.current_bid != null ? dollars(a.current_bid) : '—', inline: true },
      ],
      footer: { text: 'Ride Out Customs · Auktion' },
      timestamp: new Date().toISOString(),
    });
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

  return { ok: true };
}

export async function deleteAuction({ auctionId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!auctionId) return { ok: false, error: 'Keine Auktion gewählt.' };
  const { error } = await admin.from('auctions').delete().eq('id', auctionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
