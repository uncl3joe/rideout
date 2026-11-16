'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';
import { storagePathFromPublicUrl } from '@/lib/image-resize';

const cap = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Nur Bilder aus dem eigenen Bucket-Unterordner 'tausch/' zulassen. Verhindert,
// dass über die öffentliche Action fremde oder beliebige URLs gespeichert werden.
function cleanImage(u) {
  u = typeof u === 'string' ? u.trim() : '';
  if (!u) return null;
  return u.includes('/storage/v1/object/public/vehicles/tausch/') ? u : null;
}

// ---------------- Öffentlich: Inserat einstellen ----------------
export async function createListing({ firstName, lastName, phone, offerModel, offerImage, seekText, seekImage }) {
  firstName = cap(firstName, 40);
  lastName = cap(lastName, 40);
  phone = cap(phone, 40);
  offerModel = cap(offerModel, 80);
  seekText = cap(seekText, 500);
  offerImage = cleanImage(offerImage);
  seekImage = cleanImage(seekImage);

  if (!firstName || !lastName) return { ok: false, error: 'Bitte Vor- und Nachnamen angeben.' };
  if (!phone) return { ok: false, error: 'Bitte eine Telefonnummer angeben.' };
  if (!offerModel) return { ok: false, error: 'Bitte das Fahrzeug angeben, das du anbietest.' };
  if (!offerImage) return { ok: false, error: 'Bitte ein Foto deines Fahrzeugs hochladen.' };
  if (!seekText) return { ok: false, error: 'Bitte angeben, welches Fahrzeug du suchst.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Server ist nicht konfiguriert.' };

  const { error } = await admin.from('trade_listings').insert({
    first_name: firstName,
    last_name: lastName,
    phone,
    offer_model: offerModel,
    offer_image: offerImage,
    seek_text: seekText,
    seek_image: seekImage,
  });
  if (error) return { ok: false, error: 'Konnte das Inserat nicht speichern.' };
  return { ok: true };
}

// ---------------- Backend (Leitung): Inserat entfernen ----------------
async function removeStorageImage(admin, url) {
  const path = storagePathFromPublicUrl(url, 'vehicles');
  if (!path) return;
  try {
    await admin.storage.from('vehicles').remove([path]);
  } catch {
    /* altes Bild weg zu bekommen ist nicht kritisch */
  }
}

export async function deleteListing({ id }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!id) return { ok: false, error: 'Kein Inserat gewählt.' };

  // Bild-Pfade merken, um die Dateien nach dem Löschen mit zu entfernen.
  const { data: row } = await admin
    .from('trade_listings')
    .select('offer_image, seek_image')
    .eq('id', id)
    .single();

  const { error } = await admin.from('trade_listings').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  await removeStorageImage(admin, row?.offer_image);
  await removeStorageImage(admin, row?.seek_image);
  return { ok: true };
}
