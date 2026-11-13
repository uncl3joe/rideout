// Verkleinert und komprimiert Bilder direkt im Browser, bevor sie zu Supabase
// hochgeladen werden. Das spart massiv Bandbreite (Cached Egress), weil die
// oeffentlichen Seiten dann kleine Bilder ausliefern statt mehrere MB grosser
// Originale. Laeuft nur im Browser (Canvas) und faellt im Zweifel aufs Original
// zurueck, damit ein Upload nie daran scheitert.

const MAX_DIM = 1280; // laengste Kante in Pixeln
const QUALITY = 0.82; // WebP/JPEG-Qualitaet
const SMALL_ENOUGH = 450 * 1024; // darunter wird ohne force nicht mehr angefasst

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

// Nimmt eine Bilddatei oder einen Blob und gibt eine verkleinerte Datei zurueck.
// opts: { maxDim, quality, force }. Bei Problemen kommt das Original zurueck.
export async function shrinkImage(file, opts = {}) {
  const maxDim = opts.maxDim || MAX_DIM;
  const quality = opts.quality || QUALITY;
  const force = !!opts.force;
  try {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif') return file; // evtl. animiert, nicht anfassen

    const url = URL.createObjectURL(file);
    let img;
    try {
      img = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDim / Math.max(width, height));
    // Ohne force: schon klein genug und nicht zu gross -> Original behalten.
    if (!force && scale === 1 && (file.size || 0) <= SMALL_ENOUGH) return file;

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    // WebP bevorzugen (deutlich kleiner), sonst JPEG.
    let type = 'image/webp';
    let blob = await canvasToBlob(canvas, type, quality);
    if (!blob) {
      type = 'image/jpeg';
      blob = await canvasToBlob(canvas, type, quality);
    }
    if (!blob) return file;
    // Nur nehmen, wenn wirklich kleiner als das Original.
    if ((file.size || 0) && blob.size >= file.size) return file;

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const base = String(file.name || 'bild').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'bild';
    return new File([blob], base + '.' + ext, { type });
  } catch {
    return file; // im Zweifel Original hochladen
  }
}

// Holt aus einer oeffentlichen Supabase-URL den Objekt-Pfad innerhalb des Buckets.
// z. B. .../storage/v1/object/public/vehicles/123_foto.jpg  ->  123_foto.jpg
export function storagePathFromPublicUrl(url, bucket) {
  if (typeof url !== 'string') return null;
  const mark = '/storage/v1/object/public/' + bucket + '/';
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
