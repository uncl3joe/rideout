// Fahrzeughandel-Benachrichtigung als transienter Ping. Ein neues Fahrzeug wird
// in den Fahrzeughandel-Channel gepingt und über lib/discord-pings.js automatisch
// wieder aufgeräumt. Das Fahrzeug selbst lebt auf /shop und im Backend.

import { recordPing } from '@/lib/discord-pings';

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE') + ' $';
const PUBLIC_SHOP_URL = 'https://rideout-kappa.vercel.app/shop';

const hook = () => process.env.DISCORD_SHOP_WEBHOOK || '';
const roleId = () => process.env.DISCORD_SHOP_ROLE_ID || '';
const mentionPrefix = () => (roleId() ? '<@&' + roleId() + '> ' : '');
const allowedMentions = () => (roleId() ? { parse: [], roles: [roleId()] } : { parse: [] });

function buildVehicleEmbed(v) {
  const embed = {
    title: '🚗 Neues Fahrzeug im Fahrzeughandel',
    description: '**' + (v.model || 'Fahrzeug') + '**' + (v.price != null ? '\nPreis: ' + fmt(v.price) : ''),
    color: 0xff7a1a,
    fields: [],
    footer: { text: 'Ride Out Customs · Fahrzeughandel' },
  };
  if (v.seller_name) embed.fields.push({ name: 'Verkäufer', value: v.seller_name, inline: true });
  if (v.image_url) embed.image = { url: v.image_url };
  return embed;
}

// Postet den Fahrzeug-Ping (mit Bild + Rollen-Ping) und registriert ihn fürs Aufräumen.
export async function postVehicleMessage(admin, v) {
  const h = hook();
  if (!h || !v) return;
  const content = mentionPrefix() + 'Ein neues Fahrzeug ist da: **' + (v.model || 'Fahrzeug') + '**. Zum Fahrzeughandel: ' + PUBLIC_SHOP_URL;
  try {
    const r = await fetch(h + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds: [buildVehicleEmbed(v)], allowed_mentions: allowedMentions() }),
    });
    if (!r.ok) return;
    const j = await r.json().catch(() => null);
    if (j && j.id) await recordPing(admin, { messageId: String(j.id), kind: 'shop', refId: v.id });
  } catch {
    /* optional */
  }
}
