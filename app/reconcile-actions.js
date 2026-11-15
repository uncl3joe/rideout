'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireInhaber } from '@/lib/guards';

// ---------- Helfer ----------
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const dateOf = (erstellt) => String(erstellt || '').slice(0, 10); // "YYYY-MM-DD HH:MM" -> "YYYY-MM-DD"

function lev(a, b) {
  a = a || ''; b = b || '';
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Materialwert eines Schritts bestimmen: gespeicherter Wert > Katalog-Treffer > fehlt.
function resolveStepMaterial(schritt, savedMap, catalogMap) {
  const key = schritt;
  if (Object.prototype.hasOwnProperty.call(savedMap, key)) return { material: savedMap[key], source: 'saved' };
  const c = catalogMap[norm(schritt)];
  if (c != null) return { material: Number(c), source: 'katalog' };
  return { material: null, source: 'fehlt' };
}

async function loadRefs(admin) {
  const [prof, svc, sm, al, existing] = await Promise.all([
    admin.from('profiles').select('id, name, provision_rate, role, active'),
    admin.from('services').select('name, material'),
    admin.from('step_materials').select('schritt, material'),
    admin.from('mechanic_aliases').select('alias_norm, mechanic_id'),
    admin.from('orders').select('script_auftrag').not('script_auftrag', 'is', null),
  ]);
  const profiles = (prof.data || []).map((p) => ({ id: p.id, name: p.name, rate: p.provision_rate != null ? Number(p.provision_rate) : 0.3, role: p.role }));
  const catalogMap = {};
  for (const s of svc.data || []) if (s.name && catalogMap[norm(s.name)] == null) catalogMap[norm(s.name)] = Number(s.material || 0);
  const savedMap = {};
  for (const r of sm.data || []) savedMap[r.schritt] = Number(r.material || 0);
  const aliasMap = {};
  for (const r of al.data || []) aliasMap[r.alias_norm] = r.mechanic_id;
  const importedIds = new Set((existing.data || []).map((r) => Number(r.script_auftrag)));
  return { profiles, catalogMap, savedMap, aliasMap, importedIds };
}

// Ordnet einen JSON-Namen einem Profil zu: Alias > exakt (normalisiert) > Vorschlag.
function matchMechanic(name, profiles, aliasMap) {
  const n = norm(name);
  if (!n) return { status: 'none', mechanicId: null };
  if (aliasMap[n]) return { status: 'alias', mechanicId: aliasMap[n] };
  const exact = profiles.find((p) => norm(p.name) === n);
  if (exact) return { status: 'auto', mechanicId: exact.id };
  // Vorschlag ueber kleinste Editierdistanz (nur wenn nah dran).
  let best = null, bestD = 99;
  for (const p of profiles) {
    const d = lev(n, norm(p.name));
    if (d < bestD) { bestD = d; best = p; }
  }
  if (best && bestD <= 3) return { status: 'suggest', mechanicId: null, suggestionId: best.id, suggestionName: best.name };
  return { status: 'none', mechanicId: null };
}

// ---------- Analyse (Vorschau) ----------
export async function analyzeImport({ jobs }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!Array.isArray(jobs) || !jobs.length) return { ok: false, error: 'Keine Aufträge im File.' };

  const { profiles, catalogMap, savedMap, aliasMap, importedIds } = await loadRefs(admin);

  // Zeitraum aus den Auftragsdaten.
  const dates = jobs.map((j) => dateOf(j.erstellt)).filter(Boolean).sort();
  const periodStart = dates[0] || null;
  const periodEnd = dates[dates.length - 1] || null;

  // Distinkte Schritte -> Materialwerte.
  const stepSet = new Map();
  for (const j of jobs) for (const s of j.schritte || []) {
    const name = s.schritt;
    if (name && !stepSet.has(name)) stepSet.set(name, resolveStepMaterial(name, savedMap, catalogMap));
  }
  const steps = [...stepSet.entries()].map(([schritt, r]) => ({ schritt, material: r.material, source: r.source })).sort((a, b) => a.schritt.localeCompare(b.schritt));

  // Distinkte Mechaniker-Namen -> Zuordnung.
  const nameSet = new Map();
  for (const j of jobs) {
    const nm = j.mechaniker;
    const key = norm(nm);
    if (!nameSet.has(key)) nameSet.set(key, { name: nm, norm: key, ...matchMechanic(nm, profiles, aliasMap) });
  }
  const mechNames = [...nameSet.values()];

  // Ist-Seite: Hand-Eintraege im Zeitraum (nicht ersetzt), je Mechaniker aggregiert.
  let istByMech = {};
  if (periodStart && periodEnd) {
    const { data: manual } = await admin
      .from('orders')
      .select('mechanic_id, umsatz, material_total, reingewinn, provision, superseded, source, order_date')
      .gte('order_date', periodStart)
      .lte('order_date', periodEnd);
    for (const o of manual || []) {
      if (o.source === 'script') continue;
      if (o.superseded) continue;
      const k = o.mechanic_id || '—';
      const a = istByMech[k] || (istByMech[k] = { auf: 0, umsatz: 0, reingewinn: 0, provision: 0 });
      a.auf += 1; a.umsatz += o.umsatz || 0; a.reingewinn += o.reingewinn || 0; a.provision += o.provision || 0;
    }
  }

  return {
    ok: true,
    period: { start: periodStart, end: periodEnd },
    profiles: profiles.filter((p) => p.role).map((p) => ({ id: p.id, name: p.name, rate: p.rate })),
    steps,
    mechNames,
    alreadyImported: [...importedIds],
    istByMech,
  };
}

// ---------- Übernahme ----------
export async function commitImport({ jobs, nameMap, stepMaterials }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!Array.isArray(jobs) || !jobs.length) return { ok: false, error: 'Keine Aufträge im File.' };

  // 1) Material-Zuordnungen speichern (vom Inhaber bestaetigt/ergaenzt).
  const smRows = Object.entries(stepMaterials || {})
    .filter(([s, v]) => s && v !== '' && v != null && !Number.isNaN(Number(v)))
    .map(([schritt, v]) => ({ schritt, material: Math.max(0, Math.round(Number(v))), updated_at: new Date().toISOString() }));
  if (smRows.length) await admin.from('step_materials').upsert(smRows, { onConflict: 'schritt' });

  // 2) Namenszuordnungen speichern.
  const alRows = Object.entries(nameMap || {})
    .filter(([n, id]) => n && id)
    .map(([alias_norm, mechanic_id]) => ({ alias_norm, mechanic_id, updated_at: new Date().toISOString() }));
  if (alRows.length) await admin.from('mechanic_aliases').upsert(alRows, { onConflict: 'alias_norm' });

  // 3) Referenzdaten frisch laden (nach dem Speichern), serverseitig neu rechnen.
  const { profiles, catalogMap, savedMap, aliasMap, importedIds } = await loadRefs(admin);
  const profById = {}; for (const p of profiles) profById[p.id] = p;
  const resolveMech = (name) => {
    const n = norm(name);
    if (nameMap && nameMap[n]) return nameMap[n];
    if (aliasMap[n]) return aliasMap[n];
    const exact = profiles.find((p) => norm(p.name) === n);
    return exact ? exact.id : null;
  };
  const stepMat = (schritt) => {
    if (Object.prototype.hasOwnProperty.call(savedMap, schritt)) return savedMap[schritt];
    const c = catalogMap[norm(schritt)];
    return c != null ? Number(c) : 0;
  };

  const eventAtOf = (erstellt) => String(erstellt || '').trim() || null; // Roh-Zeitstempel verbatim

  const dates = jobs.map((j) => dateOf(j.erstellt)).filter(Boolean).sort();
  const periodStart = dates[0] || null;
  const periodEnd = dates[dates.length - 1] || null;

  let imported = 0, updated = 0, skippedNoMech = 0, skippedStatus = 0;
  const rows = [];
  for (const j of jobs) {
    if (j.stand !== 'Abgerechnet') { skippedStatus++; continue; }
    const id = Number(j.auftrag);
    if (!id) { skippedStatus++; continue; }
    const mechId = resolveMech(j.mechaniker);
    if (!mechId || !profById[mechId]) { skippedNoMech++; continue; }
    const rate = profById[mechId].rate;
    const umsatz = Math.round(Number(j.abgerechnet) || 0);
    let material = 0;
    for (const s of j.schritte || []) material += stepMat(s.schritt);
    material = Math.round(material);
    const reingewinn = umsatz - material;
    const provision = Math.max(0, Math.round(reingewinn * rate));
    if (importedIds.has(id)) updated++; else imported++;
    rows.push({
      mechanic_id: mechId,
      mechanic_name: profById[mechId].name,
      customer: j.kunde || '',
      kennzeichen: j.kennzeichen || null,
      order_date: dateOf(j.erstellt),
      event_at: eventAtOf(j.erstellt),
      screenshot_sum: null,
      adjust_factor: 1,
      umsatz,
      material_total: material,
      reingewinn,
      provision,
      source: 'script',
      script_auftrag: id,
      superseded: false,
    });
  }

  if (rows.length) {
    // Upsert über die Auftragsnummer: neue Aufträge werden eingefügt, schon
    // vorhandene aktualisiert (Datum, Uhrzeit, Kennzeichen), ohne Dubletten.
    for (let i = 0; i < rows.length; i += 200) {
      const slice = rows.slice(i, i + 200);
      const { error } = await admin.from('orders').upsert(slice, { onConflict: 'script_auftrag' });
      if (error) return { ok: false, error: error.message };
    }
  }

  // 4) Hand-Eintraege im Zeitraum als ersetzt markieren (zaehlen nicht mehr zur Auszahlung).
  let superseded = 0;
  if (periodStart && periodEnd) {
    const { data: sup } = await admin
      .from('orders')
      .update({ superseded: true })
      .eq('source', 'manual')
      .eq('superseded', false)
      .gte('order_date', periodStart)
      .lte('order_date', periodEnd)
      .select('id');
    superseded = (sup || []).length;
  }

  // 5) Protokoll.
  await admin.from('script_imports').insert({
    period_start: periodStart,
    period_end: periodEnd,
    jobs_total: jobs.length,
    jobs_imported: imported + updated,
    jobs_skipped: skippedNoMech + skippedStatus,
    imported_by: chk.user.id,
  });

  return { ok: true, imported, updated, skippedNoMech, skippedStatus, superseded, period: { start: periodStart, end: periodEnd } };
}
