// Öffentliche Auktions-Benachrichtigung in Discord (eigener Webhook).
// Postet beim Start eine Nachricht und aktualisiert GENAU DIESE Nachricht
// bei jedem Gebot (Live-Ansicht). Beim Ende wird sie auf "beendet" gesetzt
// und zusätzlich eine neue End-Nachricht gepostet.

const ANTI_SNIPE_MS = 30 * 1000;
function effEnd(a) {
  const base = new Date(a.ends_at).getTime();
  const lb = a.last_bid_at ? new Date(a.last_bid_at).getTime() + ANTI_SNIPE_MS : 0;
  return Math.max(base, lb);
}
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE') + ' $';
const hook = () => process.env.DISCORD_AUCTION_WEBHOOK || '';
const PUBLIC_URL = 'https://rideout-kappa.vercel.app/auktion';

// Rollen-Markierung der Bürgergruppe (ID kommt aus der Umgebungsvariable).
// Ohne gesetzte ID wird die Nachricht trotzdem gepostet, nur ohne Ping.
const roleId = () => process.env.DISCORD_AUCTION_ROLE_ID || '';
const mentionPrefix = () => (roleId() ? '<@&' + roleId() + '> ' : '');
const allowedMentions = () => (roleId() ? { parse: [], roles: [roleId()] } : { parse: [] });

// Start-Text (mit Ping) für die kombinierte Auktions-Nachricht.
export function auctionStartContent(a) {
  return mentionPrefix() + '🔨 Die Auktion für das Fahrzeug **' + (a.model || 'Fahrzeug') + '** ist gestartet. Jetzt mitbieten: ' + PUBLIC_URL;
}
// End-Text (ohne Ping-Präfix; der Ping wird beim Posten vorangestellt).
function auctionEndText(a) {
  const winner = a.winner_ic || a.current_bid_ic;
  return '🏁 Die Auktion für das Fahrzeug **' + (a.model || 'Fahrzeug') + '** ist jetzt beendet.' +
    (winner ? ' Zuschlag an ' + winner + (a.current_bid != null ? ' für ' + fmt(a.current_bid) : '') + '.' : ' Es gab kein Gebot.');
}

export function buildAuctionEmbed(a, topBids, ended) {
  const bids = (topBids || []).slice(0, 5);
  const bidsText = bids.length ? bids.map((b) => '• ' + b.ic_name + ' — ' + fmt(b.amount)).join('\n') : 'Noch keine Gebote';
  const fields = [];
  // Anbieter: Mitarbeiter (mit seller_id) oder Kundenfahrzeug (freier Name, ohne seller_id).
  if (a.seller_name) {
    fields.push({ name: 'Anbieter', value: a.seller_id ? a.seller_name : a.seller_name + ' (Kunde)', inline: true });
  }
  if (ended) {
    fields.push({ name: 'Gewinner', value: a.winner_ic || a.current_bid_ic || 'Kein Gebot', inline: true });
    fields.push({ name: 'Zuschlag', value: a.current_bid != null ? fmt(a.current_bid) : '—', inline: true });
  } else {
    fields.push({ name: 'Aktuelles Höchstgebot', value: a.current_bid != null ? fmt(a.current_bid) + (a.current_bid_ic ? ' (' + a.current_bid_ic + ')' : '') : 'Startpreis ' + fmt(a.start_price), inline: false });
    fields.push({ name: 'Mindest-Erhöhung', value: fmt(a.min_increment), inline: true });
    fields.push({ name: 'Endet', value: '<t:' + Math.floor(effEnd(a) / 1000) + ':R>', inline: true });
    fields.push({ name: 'Letzte Gebote', value: bidsText, inline: false });
  }
  const embed = {
    title: (ended ? '🏁 Auktion beendet: ' : '🔨 Live-Auktion: ') + (a.model || 'Fahrzeug'),
    color: ended ? 0x37a6ea : 0xff7a1a,
    fields,
    footer: { text: 'Ride Out Customs · mitbieten auf der Homepage unter /auktion' },
    timestamp: new Date().toISOString(),
  };
  if (a.image_url) embed.image = { url: a.image_url };
  return embed;
}

// Postet eine neue Nachricht und gibt deren ID zurück (für spätere Updates).
// Optionaler content erlaubt eine Rollen-Markierung (z. B. beim Ende).
export async function postAuctionMessage(embed, content) {
  const h = hook();
  if (!h) return null;
  const payload = { embeds: [embed] };
  if (content) {
    payload.content = content;
    payload.allowed_mentions = allowedMentions();
  }
  try {
    const r = await fetch(h + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && j.id ? String(j.id) : null;
  } catch {
    return null;
  }
}

// Erinnerungs-Ping an die Bürgergruppe als eigene Nachricht. Gibt die Nachrichten-ID
// zurück, damit die vorige Erinnerung später gezielt gelöscht werden kann.
// kind: '60' (rund 1 Stunde vorher) oder '15' (rund 15 Minuten vorher).
export async function sendAuctionPing(a, kind) {
  const h = hook();
  if (!h) return null;
  const base = 'Die Auktion für das Fahrzeug **' + (a.model || 'Fahrzeug') + '** ';
  let text;
  if (kind === '60') {
    text = mentionPrefix() + '⏳ ' + base + 'läuft noch 1 Stunde. Mitbieten: ' + PUBLIC_URL;
  } else if (kind === '15') {
    text = mentionPrefix() + '🔔 ' + base + 'läuft noch 15 Minuten. Mitbieten: ' + PUBLIC_URL;
  } else {
    return null;
  }
  try {
    const r = await fetch(h + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, allowed_mentions: allowedMentions() }) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && j.id ? String(j.id) : null;
  } catch {
    return null;
  }
}

// Eine Erinnerungs-Nachricht gezielt löschen (z. B. die vorige Erinnerung).
export async function deleteReminderMessage(messageId) {
  await deleteMessage(messageId);
}

async function editAuctionMessage(messageId, embed, content) {
  const h = hook();
  if (!h || !messageId) return;
  const payload = { embeds: [embed] };
  if (content !== undefined) {
    payload.content = content;
    payload.allowed_mentions = { parse: [] }; // beim Bearbeiten nie pingen
  }
  try {
    await fetch(h + '/messages/' + messageId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch {
    /* optional */
  }
}

async function deleteMessage(messageId) {
  const h = hook();
  if (!h || !messageId) return;
  try {
    await fetch(h + '/messages/' + messageId, { method: 'DELETE' });
  } catch {
    /* optional */
  }
}

// Alle Discord-Nachrichten einer Auktion löschen (Live-, End- und Erinnerungs-Nachrichten).
export async function deleteAuctionMessages(a) {
  if (!a) return;
  await deleteMessage(a.discord_message_id);
  await deleteMessage(a.discord_end_message_id);
  await deleteMessage(a.reminder_60_msg_id);
  await deleteMessage(a.reminder_15_msg_id);
}

// Live-Nachricht einer Auktion mit aktuellem Stand aktualisieren.
export async function refreshAuctionMessage(admin, auctionId) {
  const { data: a } = await admin.from('auctions').select('*').eq('id', auctionId).single();
  if (!a || !a.discord_message_id) return;
  const { data: bids } = await admin.from('bids').select('ic_name, amount').eq('auction_id', auctionId).order('amount', { ascending: false }).limit(5);
  await editAuctionMessage(a.discord_message_id, buildAuctionEmbed(a, bids || [], a.status === 'ended'));
}

// Beim Ende: Live-Nachricht auf "beendet" setzen UND eine neue End-Nachricht posten.
export async function finalizeAuctionMessages(admin, auctionId) {
  const { data: a } = await admin.from('auctions').select('*').eq('id', auctionId).single();
  if (!a) return;
  // Die Auktion ist vorbei, stehende Erinnerungen (1 Stunde / 15 Minuten) entfernen.
  if (a.reminder_60_msg_id) await deleteMessage(a.reminder_60_msg_id);
  if (a.reminder_15_msg_id) await deleteMessage(a.reminder_15_msg_id);
  const { data: bids } = await admin.from('bids').select('ic_name, amount').eq('auction_id', auctionId).order('amount', { ascending: false }).limit(5);
  const embed = buildAuctionEmbed(a, bids || [], true);
  // Live-Nachricht auf "beendet" setzen und den Start-Text durch den End-Text ersetzen (ohne erneuten Ping).
  if (a.discord_message_id) await editAuctionMessage(a.discord_message_id, embed, auctionEndText(a));
  // Zusätzliche End-Benachrichtigung unten im Channel posten, diese pingt die Bürgergruppe einmalig.
  const endId = await postAuctionMessage(embed, mentionPrefix() + auctionEndText(a));
  await admin.from('auctions').update({ discord_end_message_id: endId || null, reminder_60_msg_id: null, reminder_15_msg_id: null }).eq('id', auctionId);
}
