'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';

// Löscht die interne Discord-Reservierungsmeldung (falls vorhanden).
async function deleteReservationDiscord(messageId) {
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook || !messageId) return;
  try {
    await fetch(hook + '/messages/' + messageId, { method: 'DELETE' });
  } catch {
    /* optional */
  }
}

// Offene Reservierungen eines Fahrzeugs auflösen: Discord-Meldung löschen + Zeile entfernen.
async function clearReservations(admin, vehicleId) {
  const { data: res } = await admin.from('reservations').select('id, discord_message_id').eq('vehicle_id', vehicleId);
  for (const r of res || []) {
    await deleteReservationDiscord(r.discord_message_id);
    await admin.from('reservations').delete().eq('id', r.id);
  }
}

// Fahrzeug-Status setzen. Wird es auf "verfügbar" oder "verkauft" gesetzt,
// verschwinden die offenen Reservierungen samt Discord-Meldung automatisch.
export async function setVehicleStatus({ vehicleId, status }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!vehicleId || !['verfuegbar', 'reserviert', 'verkauft'].includes(status)) return { ok: false, error: 'Ungültige Eingabe.' };

  const { error } = await admin.from('vehicles').update({ status }).eq('id', vehicleId);
  if (error) return { ok: false, error: error.message };

  if (status === 'verfuegbar' || status === 'verkauft') {
    await clearReservations(admin, vehicleId);
  }
  return { ok: true };
}

// Fahrzeug löschen (inkl. Discord-Meldung der Reservierung).
export async function deleteVehicle({ vehicleId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!vehicleId) return { ok: false, error: 'Kein Fahrzeug gewählt.' };
  await clearReservations(admin, vehicleId);
  const { error } = await admin.from('vehicles').delete().eq('id', vehicleId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Reservierung löschen (inkl. Discord-Meldung).
export async function deleteReservation({ reservationId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!reservationId) return { ok: false, error: 'Keine Reservierung gewählt.' };
  const { data: r } = await admin.from('reservations').select('discord_message_id').eq('id', reservationId).single();
  if (r) await deleteReservationDiscord(r.discord_message_id);
  const { error } = await admin.from('reservations').delete().eq('id', reservationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Reservierung als erledigt markieren (Discord-Meldung ebenfalls entfernen).
export async function markReservationHandled({ reservationId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!reservationId) return { ok: false, error: 'Keine Reservierung gewählt.' };
  const { data: r } = await admin.from('reservations').select('discord_message_id').eq('id', reservationId).single();
  if (r) await deleteReservationDiscord(r.discord_message_id);
  const { error } = await admin.from('reservations').update({ handled: true, discord_message_id: null }).eq('id', reservationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
