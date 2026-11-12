// Zentrale Verwaltung der transienten Ping-Nachrichten (Auktionen + Fahrzeughandel).
// Jeder Ping wird nach dem Posten hier registriert und dann automatisch aufgeräumt:
//  - zeitlich: nach PING_TTL_MIN Minuten (cleanupExpiredPings)
//  - ablösend: ein Ping wird gezielt entfernt (removePing)
//  - beim Abschluss: alle Pings eines Objekts auf einmal (sweepPings)

const PING_TTL_MIN = 30; // Pings verschwinden nach 30 Minuten

function hookFor(kind) {
  return kind === 'shop' ? (process.env.DISCORD_SHOP_WEBHOOK || '') : (process.env.DISCORD_AUCTION_WEBHOOK || '');
}

async function deleteDiscordMessage(messageId, kind) {
  const h = hookFor(kind);
  if (!h || !messageId) return;
  try {
    await fetch(h + '/messages/' + messageId, { method: 'DELETE' });
  } catch {
    /* 404 bei schon gelöschter Nachricht ist egal */
  }
}

// Einen geposteten Ping registrieren.
export async function recordPing(admin, { messageId, kind, refId }) {
  if (!admin || !messageId) return;
  try {
    await admin.from('discord_pings').insert({ message_id: messageId, kind: kind || 'auction', ref_id: refId || null });
  } catch {
    /* optional */
  }
}

// Einen einzelnen Ping entfernen (Discord-Nachricht + Registrierung).
export async function removePing(admin, messageId, kind) {
  if (!messageId) return;
  await deleteDiscordMessage(messageId, kind);
  if (admin) {
    try { await admin.from('discord_pings').delete().eq('message_id', messageId); } catch {}
  }
}

// Alle Pings eines Objekts entfernen (Abschluss-Sweep bei verkauft/beendet/erledigt/gelöscht).
export async function sweepPings(admin, refId) {
  if (!admin || !refId) return;
  const { data: rows } = await admin.from('discord_pings').select('id, message_id, kind').eq('ref_id', refId);
  for (const r of rows || []) {
    await deleteDiscordMessage(r.message_id, r.kind);
    await admin.from('discord_pings').delete().eq('id', r.id);
  }
}

// Zeitliches Aufräumen: alle Pings, die älter als das Fenster sind.
export async function cleanupExpiredPings(admin) {
  if (!admin) return 0;
  const cutoff = new Date(Date.now() - PING_TTL_MIN * 60 * 1000).toISOString();
  const { data: rows } = await admin.from('discord_pings').select('id, message_id, kind').lt('created_at', cutoff);
  let n = 0;
  for (const r of rows || []) {
    await deleteDiscordMessage(r.message_id, r.kind);
    await admin.from('discord_pings').delete().eq('id', r.id);
    n++;
  }
  return n;
}
