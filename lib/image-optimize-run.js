// Einmalige Aufraeum-Aktion: verkleinert alle bereits hochgeladenen Fahrzeug- und
// Auktionsbilder. Laeuft komplett im Browser der angemeldeten Leitung: Bild holen,
// verkleinern, neu hochladen, dann per Server-Action die DB-URL umbiegen und das
// alte Original aus dem Speicher loeschen. Rein additiv, kein SQL noetig.

import { createClient } from '@/lib/supabase/client';
import { shrinkImage, storagePathFromPublicUrl } from '@/lib/image-resize';
import { replaceEntityImage } from '@/app/shop-admin-actions';

const BUCKET = 'vehicles';
const PUBLIC_MARK = '/storage/v1/object/public/' + BUCKET + '/';

function isOurImage(url) {
  return typeof url === 'string' && url.includes(PUBLIC_MARK);
}

async function fetchAsFile(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  return new File([blob], 'original', { type: blob.type || 'image/jpeg' });
}

async function uploadSmall(sb, file) {
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = 'opt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '2592000' });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Fuehrt die Optimierung aus. onProgress bekommt Zwischenstaende, Rueckgabe ist die Zusammenfassung.
export async function runImageOptimization({ onProgress } = {}) {
  const sb = createClient();
  const [{ data: vehicles }, { data: auctions }] = await Promise.all([
    sb.from('vehicles').select('id, image_url'),
    sb.from('auctions').select('id, image_url'),
  ]);

  const items = [];
  for (const v of vehicles || []) if (isOurImage(v.image_url)) items.push({ table: 'vehicles', id: v.id, url: v.image_url });
  for (const a of auctions || []) if (isOurImage(a.image_url)) items.push({ table: 'auctions', id: a.id, url: a.image_url });

  const total = items.length;
  let done = 0;
  let shrunk = 0;
  let skipped = 0;
  let failed = 0;
  let savedBytes = 0;

  if (onProgress) onProgress({ phase: 'start', total });

  for (const it of items) {
    done++;
    try {
      const orig = await fetchAsFile(it.url);
      const origSize = orig.size || 0;
      const small = await shrinkImage(orig, { force: true });
      const newSize = small.size || 0;
      // Nur ersetzen, wenn spuerbar kleiner (mind. 15 % und mehr als 20 KB gespart).
      if (!newSize || newSize >= origSize * 0.85 || origSize - newSize < 20 * 1024) {
        skipped++;
        if (onProgress) onProgress({ phase: 'item', done, total, action: 'skip' });
        continue;
      }
      const newUrl = await uploadSmall(sb, small);
      const oldPath = storagePathFromPublicUrl(it.url, BUCKET);
      const res = await replaceEntityImage({ table: it.table, id: it.id, newUrl, oldPath });
      if (!res || !res.ok) {
        // DB blieb unveraendert -> das eben hochgeladene kleine Bild wieder entfernen.
        try {
          const np = storagePathFromPublicUrl(newUrl, BUCKET);
          if (np) await sb.storage.from(BUCKET).remove([np]);
        } catch {
          /* egal */
        }
        failed++;
        if (onProgress) onProgress({ phase: 'item', done, total, action: 'fail' });
        continue;
      }
      shrunk++;
      savedBytes += origSize - newSize;
      if (onProgress) onProgress({ phase: 'item', done, total, action: 'shrink' });
    } catch {
      failed++;
      if (onProgress) onProgress({ phase: 'item', done, total, action: 'fail' });
    }
  }

  const summary = { total, shrunk, skipped, failed, savedMB: Math.round((savedBytes / (1024 * 1024)) * 10) / 10 };
  if (onProgress) onProgress({ phase: 'done', ...summary });
  return summary;
}
