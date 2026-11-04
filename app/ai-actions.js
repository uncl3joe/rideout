'use server';

import { createClient } from '@/lib/supabase/server';

// Liest einen Werkstatt-Screenshot per Google Gemini aus und ordnet die
// erkannten Zeilen dem echten Katalog zu. Preise/Logik bleiben in der App.
export async function readScreenshot({ imageBase64, mimeType }) {
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
    'Lass Zeilen weg, die zu keinem Namen passen. Wenn eine Leistung mehrfach vorkommt, zähle sie zusammen.';

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

  const kunde = String(parsed.kunde || '').trim();
  const kennz = String(parsed.kennzeichen || '').trim();
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
