'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';
import { postVehicleMessage } from '@/lib/shop-discord';
import { sweepPings } from '@/lib/discord-pings';

// Objekt-Pfad aus einer öffentlichen Supabase-URL (Bucket "vehicles").
function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;
  const mark = '/storage/v1/object/public/vehicles/';
  const i = url.indexOf(mark);
  if (i < 0) return null;
  let p = url.slice(i + mark.length);
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  try {
    p = decodeURIComponent(p);
  } catch {
    /* Pfad bleibt wie er ist */
  }
  return p || null;
}

// Entfernt das zugehörige Bild aus dem Speicher (best effort, kein Fehler nach außen).
async function removeStorageImage(admin, url) {
  const path = storagePathFromUrl(url);
  if (!path) return;
  try {
    await admin.storage.from('vehicles').remove([path]);
  } catch {
    /* altes Bild weg zu bekommen ist nicht kritisch */
  }
}

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
  // Beim Verkauf den Fahrzeug-Ping aus dem Fahrzeughandel-Channel entfernen.
  if (status === 'verkauft') {
    await sweepPings(admin, vehicleId);
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
  // Bild-Pfad vor dem Löschen merken, um die Datei anschließend mit zu entfernen.
  const { data: v } = await admin.from('vehicles').select('image_url').eq('id', vehicleId).single();
  // Fahrzeug-Ping im Fahrzeughandel-Channel entfernen, dann aufräumen und löschen.
  await sweepPings(admin, vehicleId);
  await clearReservations(admin, vehicleId);
  const { error } = await admin.from('vehicles').delete().eq('id', vehicleId);
  if (error) return { ok: false, error: error.message };
  await removeStorageImage(admin, v?.image_url);
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

// Nach dem Anlegen eines Fahrzeugs: öffentliche Benachrichtigung mit Ping an die
// Fahrzeughandel-Rolle in den Fahrzeughandel-Channel.
export async function announceNewVehicle({ vehicleId }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!vehicleId) return { ok: false, error: 'Kein Fahrzeug gewählt.' };
  const { data: v } = await admin.from('vehicles').select('id, model, price, seller_name, image_url').eq('id', vehicleId).single();
  if (v) await postVehicleMessage(admin, v);
  return { ok: true };
}

// Einmalige Bild-Optimierung: setzt die image_url einer Zeile auf das neue, kleinere
// Bild und loescht das alte Original aus dem Speicher. Nur fuer vehicles/auctions.
export async function replaceEntityImage({ table, id, newUrl, oldPath }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!['vehicles', 'auctions'].includes(table)) return { ok: false, error: 'Ungültige Tabelle.' };
  if (!id || !newUrl) return { ok: false, error: 'Fehlende Daten.' };

  const { error } = await admin.from(table).update({ image_url: newUrl }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  if (oldPath) {
    try {
      await admin.storage.from('vehicles').remove([oldPath]);
    } catch {
      /* altes Bild weg zu bekommen ist nicht kritisch */
    }
  }
  return { ok: true };
}
