// Öffentliche Fahrzeug-Nachricht im Fahrzeughandel-Channel. Ein neues Fahrzeug
// wird wie eine Auktion gepostet (mit Ping) und beim Verkauf oder Löschen wieder
// aus dem Channel entfernt. Eigener Webhook und eigene Rolle (Fahrzeughandel).

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

// Postet die Fahrzeug-Nachricht (mit Ping) und gibt die Nachrichten-ID zurück.
export async function postVehicleMessage(v) {
  const h = hook();
  if (!h || !v) return null;
  const content = mentionPrefix() + 'Ein neues Fahrzeug ist da: **' + (v.model || 'Fahrzeug') + '**. Zum Fahrzeughandel: ' + PUBLIC_SHOP_URL;
  try {
    const r = await fetch(h + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds: [buildVehicleEmbed(v)], allowed_mentions: allowedMentions() }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && j.id ? String(j.id) : null;
  } catch {
    return null;
  }
}

// Löscht die Fahrzeug-Nachricht wieder aus dem Channel.
export async function deleteVehicleMessage(messageId) {
  const h = hook();
  if (!h || !messageId) return;
  try {
    await fetch(h + '/messages/' + messageId, { method: 'DELETE' });
  } catch {
    /* optional */
  }
}
