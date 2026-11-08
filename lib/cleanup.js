import { createAdminClient } from '@/lib/supabase/admin';
import { finalizeAuctionMessages } from '@/lib/auction-discord';

// 30-Sekunden-Nachfrist: ein Gebot muss nach dem geplanten Ende noch 30 s
// unüberboten stehen, sonst verlängert sich die Auktion.
export const ANTI_SNIPE_MS = 30 * 1000;

export function effectiveEndMs(a) {
  const base = new Date(a.ends_at).getTime();
  const lb = a.last_bid_at ? new Date(a.last_bid_at).getTime() + ANTI_SNIPE_MS : 0;
  return Math.max(base, lb);
}

async function discordDelete(messageId) {
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook || !messageId) return;
  try {
    await fetch(hook + '/messages/' + messageId, { method: 'DELETE' });
  } catch {
    /* optional */
  }
}

// Räumt abgelaufene 24h-Reservierungen auf und finalisiert fällige Auktionen.
// Idempotent: kann beliebig oft laufen (Zeitplan-Job + beim Seitenaufruf).
export async function runCleanup() {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  let freedReservations = 0;
  let endedAuctions = 0;

  // 1) Abgelaufene 24-Stunden-Reservierungen
  const { data: expired } = await admin
    .from('reservations')
    .select('id, vehicle_id, discord_message_id')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso);
  for (const r of expired || []) {
    if (r.vehicle_id) {
      await admin.from('vehicles').update({ status: 'verfuegbar' }).eq('id', r.vehicle_id).eq('status', 'reserviert');
    }
    await discordDelete(r.discord_message_id);
    await admin.from('reservations').delete().eq('id', r.id);
    freedReservations++;
  }

  // 2) Fällige Auktionen beenden (effektives Ende inkl. 30s-Nachfrist)
  const { data: live } = await admin.from('auctions').select('*').eq('status', 'live');
  for (const a of live || []) {
    if (nowMs >= effectiveEndMs(a)) {
      const { data: upd } = await admin
        .from('auctions')
        .update({ status: 'ended', winner_ic: a.current_bid_ic || null })
        .eq('id', a.id)
        .eq('status', 'live')
        .select('id');
      if (upd && upd.length) {
        endedAuctions++;
        await finalizeAuctionMessages(admin, a.id);
      }
    }
  }

  return { ok: true, freedReservations, endedAuctions };
}
