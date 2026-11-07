'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// Öffentliche Reservierung (ohne Login). Läuft serverseitig mit vollen
// Rechten, prüft aber streng: nur verfügbare Fahrzeuge, nur Reservierung anlegen
// + Status auf "reserviert" setzen + den Verkäufer benachrichtigen.
export async function reserveVehicle({ vehicleId, name, contact }) {
  name = String(name || '').trim();
  contact = String(contact || '').trim();
  if (!vehicleId || !name || !contact) return { ok: false, error: 'Bitte Name und Kontakt angeben.' };
  if (name.length > 80 || contact.length > 80) return { ok: false, error: 'Eingabe zu lang.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Server ist nicht konfiguriert (Service-Schlüssel fehlt).' };

  const { data: veh } = await admin
    .from('vehicles')
    .select('id, model, price, status, seller_name, reserve_24h')
    .eq('id', vehicleId)
    .single();
  if (!veh) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  if (veh.status !== 'verfuegbar') return { ok: false, error: 'Dieses Fahrzeug ist leider nicht mehr verfügbar.' };

  // Bei 24h-Fahrzeugen läuft die Reservierung automatisch ab.
  const expiresAt = veh.reserve_24h ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

  const { data: res, error: e1 } = await admin
    .from('reservations')
    .insert({ vehicle_id: vehicleId, customer_name: name, customer_contact: contact, expires_at: expiresAt })
    .select('id')
    .single();
  if (e1 || !res) return { ok: false, error: 'Reservierung fehlgeschlagen.' };

  await admin.from('vehicles').update({ status: 'reserviert' }).eq('id', vehicleId);

  // Discord-Benachrichtigung (optional). Mit ?wait=true bekommen wir die
  // Nachrichten-ID zurück, damit die Meldung beim Ablauf wieder gelöscht werden kann.
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (hook) {
    try {
      const fields = [
        { name: 'Fahrzeug', value: String(veh.model || '—'), inline: true },
        { name: 'Preis', value: Number(veh.price).toLocaleString('de-DE') + ' $', inline: true },
        { name: 'Verkäufer', value: String(veh.seller_name || '—'), inline: true },
        { name: 'Kunde', value: name, inline: true },
        { name: 'Kontakt', value: contact, inline: true },
      ];
      if (expiresAt) fields.push({ name: 'Hinweis', value: 'Reservierung läuft in 24 h automatisch ab', inline: false });
      const resp = await fetch(hook + '?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: '🏎️ Neue Reservierung',
              color: 0xff7a1a,
              fields,
              footer: { text: 'Ride Out Customs · Fahrzeughandel' },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (resp.ok) {
        const msg = await resp.json().catch(() => null);
        if (msg && msg.id) {
          await admin.from('reservations').update({ discord_message_id: String(msg.id) }).eq('id', res.id);
        }
      }
    } catch {
      /* Benachrichtigung ist optional – Reservierung bleibt trotzdem gültig */
    }
  }

  return { ok: true, seller: veh.seller_name };
}
