// Öffentliche Auktions-Benachrichtigungen in Discord (eigener Webhook), als
// transiente Pings. Es gibt KEIN Live-Board mehr und keine aktualisierte
// Live-Nachricht; der Channel wird über lib/discord-pings.js automatisch
// wieder aufgeräumt. Das Mitbieten und die Live-Ansicht laufen auf /auktion.

import { recordPing, sweepPings } from '@/lib/discord-pings';

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE') + ' $';
const hook = () => process.env.DISCORD_AUCTION_WEBHOOK || '';
const PUBLIC_URL = 'https://rideout-kappa.vercel.app/auktion';

// Rollen-Markierung der Bürgergruppe. Ohne gesetzte ID wird trotzdem gepostet, nur ohne Ping.
const roleId = () => process.env.DISCORD_AUCTION_ROLE_ID || '';
const mentionPrefix = () => (roleId() ? '<@&' + roleId() + '> ' : '');
const allowedMentions = () => (roleId() ? { parse: [], roles: [roleId()] } : { parse: [] });

function buildStartEmbed(a) {
  const fields = [];
  if (a.seller_name) fields.push({ name: 'Anbieter', value: a.seller_id ? a.seller_name : a.seller_name + ' (Kunde)', inline: true });
  fields.push({ name: 'Startpreis', value: fmt(a.start_price), inline: true });
  fields.push({ name: 'Mindest-Erhöhung', value: fmt(a.min_increment), inline: true });
  fields.push({ name: 'Endet', value: '<t:' + Math.floor(new Date(a.ends_at).getTime() / 1000) + ':R>', inline: true });
  const embed = {
    title: '🔨 Neue Live-Auktion: ' + (a.model || 'Fahrzeug'),
    color: 0xff7a1a,
    fields,
    footer: { text: 'Ride Out Customs · mitbieten unter /auktion' },
  };
  if (a.image_url) embed.image = { url: a.image_url };
  return embed;
}

async function postPing(content, embed) {
  const h = hook();
  if (!h) return null;
  const payload = {};
  if (content) {
    payload.content = content;
    payload.allowed_mentions = allowedMentions();
  }
  if (embed) payload.embeds = [embed];
  try {
    const r = await fetch(h + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && j.id ? String(j.id) : null;
  } catch {
    return null;
  }
}

// Start-Ping (verschwindet automatisch nach dem Ping-Fenster).
export async function postAuctionStart(admin, a) {
  const content = mentionPrefix() + '🔨 Neue Auktion: **' + (a.model || 'Fahrzeug') + '**. Jetzt mitbieten: ' + PUBLIC_URL;
  const mid = await postPing(content, buildStartEmbed(a));
  if (mid) await recordPing(admin, { messageId: mid, kind: 'auction', refId: a.id });
  return mid;
}

// Erinnerungs-Ping. kind: '120' (2 h), '60' (1 h), '15' (15 min). Gibt die Nachrichten-ID zurück.
export async function sendAuctionReminder(admin, a, kind) {
  const base = 'Die Auktion für das Fahrzeug **' + (a.model || 'Fahrzeug') + '** ';
  const texts = {
    '120': '⏳ ' + base + 'läuft noch 2 Stunden.',
    '60': '⏳ ' + base + 'läuft noch 1 Stunde.',
    '15': '🔔 ' + base + 'läuft noch 15 Minuten.',
  };
  const t = texts[kind];
  if (!t) return null;
  const mid = await postPing(mentionPrefix() + t + ' Mitbieten: ' + PUBLIC_URL, null);
  if (mid) await recordPing(admin, { messageId: mid, kind: 'auction', refId: a.id });
  return mid;
}

// End-Ping (Zuschlag an …). Verschwindet ebenfalls nach dem Ping-Fenster.
export async function postAuctionEnd(admin, a) {
  const winner = a.winner_ic || a.current_bid_ic;
  const content = mentionPrefix() + '🏁 Die Auktion für das Fahrzeug **' + (a.model || 'Fahrzeug') + '** ist jetzt beendet.' +
    (winner ? ' Zuschlag an ' + winner + (a.current_bid != null ? ' für ' + fmt(a.current_bid) : '') + '.' : ' Es gab kein Gebot.');
  const mid = await postPing(content, null);
  if (mid) await recordPing(admin, { messageId: mid, kind: 'auction', refId: a.id });
  return mid;
}

// Beim Ende: stehende Pings (Start/Reminder) entfernen und den End-Ping posten.
export async function finalizeAuctionMessages(admin, auctionId) {
  const { data: a } = await admin.from('auctions').select('*').eq('id', auctionId).single();
  if (!a) return;
  await sweepPings(admin, auctionId);
  await postAuctionEnd(admin, a);
  await admin.from('auctions').update({ reminder_120_msg_id: null, reminder_60_msg_id: null, reminder_15_msg_id: null }).eq('id', auctionId);
}
