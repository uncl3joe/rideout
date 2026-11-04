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
    .select('id, model, price, status, seller_name')
    .eq('id', vehicleId)
    .single();
  if (!veh) return { ok: false, error: 'Fahrzeug nicht gefunden.' };
  if (veh.status !== 'verfuegbar') return { ok: false, error: 'Dieses Fahrzeug ist leider nicht mehr verfügbar.' };

  const { error: e1 } = await admin
    .from('reservations')
    .insert({ vehicle_id: vehicleId, customer_name: name, customer_contact: contact });
  if (e1) return { ok: false, error: 'Reservierung fehlgeschlagen.' };

  await admin.from('vehicles').update({ status: 'reserviert' }).eq('id', vehicleId);

  // Discord-Benachrichtigung an den Verkäufer/das Team (optional)
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (hook) {
    try {
      const msg =
        '🏎️ **Neue Reservierung – Ride Out Customs**\n' +
        '**Fahrzeug:** ' + veh.model + '\n' +
        '**Preis:** ' + Number(veh.price).toLocaleString('de-DE') + ' $\n' +
        '**Verkäufer:** ' + (veh.seller_name || '—') + '\n' +
        '**Kunde:** ' + name + ' · ' + contact;
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg }),
      });
    } catch {
      /* Benachrichtigung ist optional – Reservierung bleibt trotzdem gültig */
    }
  }

  return { ok: true, seller: veh.seller_name };
}
