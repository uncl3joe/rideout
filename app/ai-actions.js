'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalisiert Namen für den Vergleich (Groß/Klein + Mehrfach-Leerzeichen egal).
function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Liest einen Werkstatt-Screenshot per Google Gemini aus und ordnet die
// erkannten Zeilen dem echten Katalog zu. Preise/Logik bleiben in der App.
export async function readScreenshot({ imageBase64, mimeType, mechanicName }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt.' };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: 'KI-Schlüssel fehlt (GEMINI_API_KEY in Vercel eintragen).' };
  if (!imageBase64) return { ok: false, error: 'Kein Bild erhalten.' };

  const { data: services } = await sb.from('services').select('name').eq('active', true);
  const names = (services || []).map((s) => s.name);
  if (!names.length) return { ok: false, error: 'Katalog ist leer.' };

  // ALLE Mitarbeiternamen holen (über den Service-Key, damit es auch für
  // normale Mechaniker funktioniert – die dürfen sonst nur sich selbst sehen).
  // Diese Namen dürfen nie als Kunde oder Kennzeichen durchgehen.
  let staff = [];
  const admin = createAdminClient();
  if (admin) {
    const { data: team } = await admin.from('profiles').select('name');
    staff = (team || []).map((t) => t.name).filter((n) => n && n.trim());
  }
  // Sicherheits-Fallback, falls der Service-Key mal fehlt: wenigstens der
  // eigene Name (wie bisher).
  if (!staff.length && mechanicName) staff = [mechanicName];
  const staffSet = new Set(staff.map(norm));

  // Dieselbe priorisierte Modell-Kette wie im Google-Sheet-Rechner:
  // Flash-Lite zuerst (schnell, hohes Limit), dann Flash, dann Pro als Reserve.
  const MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
  ];
  const override = process.env.GEMINI_MODEL; // optional: ein Modell erzwingen
  const chain = override ? [override, ...MODELS.filter((m) => m !== override)] : MODELS;

  const prompt =
    'Du bekommst einen Screenshot aus einem GTA-Roleplay-Werkstatt-Spiel (eine Auftrags- oder Rechnungsliste). ' +
    'Erkenne die aufgelisteten Leistungen und ihre Anzahl. Ordne JEDE erkannte Zeile exakt einem Namen aus dieser Liste zu ' +
    '(benutze ausschließlich diese Schreibweisen):\n' +
    names.join('\n') +
    '\n\nGib AUSSCHLIESSLICH gültiges JSON in genau diesem Format zurück, ohne Erklärung:\n' +
    '{"items":[{"name":"<exakter Name aus der Liste>","qty":<ganze Zahl>}],"total":<Gesamtsumme in Dollar als Zahl, oder 0 wenn nicht sichtbar>,"kunde":"<Kundenname falls im Bild sichtbar, sonst leerer String>","kennzeichen":"<Kfz-Kennzeichen falls sichtbar, sonst leerer String>"}\n' +
    'Lass Zeilen weg, die zu keinem Namen passen. Wenn eine Leistung mehrfach vorkommt, zähle sie zusammen.' +
    '\n\nKunde: Der Kundenname ist der Fahrzeughalter bzw. die Person, für die die Rechnung ist. Er steht meist oben auf der Rechnung, beim Fahrzeug oder neben dem Kennzeichen. Lies ihn aus, sobald er irgendwie erkennbar ist, und gib Vor- und Nachnamen zusammen an.' +
    '\n\nKennzeichen: Lies es Zeichen für Zeichen sorgfältig. Verwechsle dabei NICHT großes I, kleines l und die Ziffer 1, und auch nicht den Buchstaben O und die Ziffer 0. GTA-Kennzeichen bestehen meist aus genau 8 Zeichen (Großbuchstaben A–Z und Ziffern 0–9), ohne Leer- oder Sonderzeichen.' +
    (staff.length
      ? '\n\nWICHTIG: Folgende Namen sind WERKSTATT-MITARBEITER, nicht Kunden. Sie stehen oft im Bild (HUD, Nametag, über dem Charakter). Gib KEINEN dieser Namen als "kunde" oder "kennzeichen" zurück, aber unterdrücke deswegen keinen echten Kundennamen:\n' +
        staff.join('\n') +
        '\nWenn ausschließlich Mitarbeiter sichtbar sind und kein echter Kunde erkennbar ist, lass "kunde" leer.'
      : '');

  const reqBody = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { response_mime_type: 'application/json', temperature: 0 },
  });

  // Modelle der Reihe nach probieren (ein Versuch pro Modell, wie im Sheet):
  // 200 gewinnt; 401/403 = Key-Problem -> abbrechen; alles andere -> nächstes Modell.
  let txt = '';
  let usedModel = '';
  let lastErr = '';
  for (const model of chain) {
    let resp;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody }
      );
    } catch {
      lastErr = 'Netzwerk/Timeout';
      continue;
    }
    if (resp.status === 200) {
      const j = await resp.json();
      txt = (j?.candidates?.[0]?.content?.parts?.[0]?.text || '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      usedModel = model;
      break;
    }
    const t = await resp.text().catch(() => '');
    lastErr = resp.status + (t ? ' ' + t.slice(0, 120) : '');
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, error: 'KI-Schlüssel ungültig oder gesperrt (' + resp.status + ').' };
    }
    // 404 / 429 / 503 / 500 … -> nächstes Modell in der Kette
  }
  if (!usedModel) {
    return { ok: false, error: 'Alle KI-Modelle gerade nicht verfügbar (' + lastErr + '). Meist in 1–2 Min. wieder frei.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(txt);
  } catch {
    return { ok: false, error: 'KI-Antwort war nicht lesbar.' };
  }

  const lower = {};
  names.forEach((n) => (lower[n.toLowerCase()] = n));
  const items = [];
  (parsed.items || []).forEach((it) => {
    const real = lower[String(it.name || '').toLowerCase().trim()];
    if (!real) return;
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const ex = items.find((x) => x.name === real);
    if (ex) ex.qty += qty;
    else items.push({ name: real, qty });
  });

  let kunde = String(parsed.kunde || '').trim();
  let kennz = String(parsed.kennzeichen || '').trim();
  // Sicherheitsnetz: niemals einen Mitarbeiter-Namen als Kunde oder Kennzeichen
  // übernehmen (auch wenn die KI ihn trotzdem einträgt).
  if (kunde && staffSet.has(norm(kunde))) kunde = '';
  if (kennz && staffSet.has(norm(kennz))) kennz = '';
  const customer = kunde && kennz ? kunde + ' (' + kennz + ')' : kunde || kennz || '';

  return {
    ok: true,
    items,
    total: Math.round(Number(parsed.total) || 0),
    customer,
    recognized: (parsed.items || []).length,
    matched: items.length,
    model: usedModel,
  };
}
