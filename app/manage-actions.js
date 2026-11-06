'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireInhaber } from '@/lib/guards';

const PROV_DEFAULT = 0.30;

function needAdmin() {
  const admin = createAdminClient();
  if (!admin) return { error: 'Service-Schlüssel fehlt (SUPABASE_SERVICE_ROLE_KEY in Vercel eintragen).' };
  return { admin };
}

// Rechnet einen Auftrag frisch aus dem Katalog durch – identisch zu saveOrder,
// damit Bearbeiten und Neuanlegen immer gleich rechnen.
async function recompute(admin, items, screenshotSum, rate) {
  const names = (items || []).map((i) => i.name);
  if (!names.length) return { error: 'Keine Positionen im Auftrag.' };
  const { data: svc, error } = await admin.from('services').select('id, name, category, vk, material').in('name', names);
  if (error) return { error: error.message };
  const byName = {};
  (svc || []).forEach((s) => (byName[s.name] = s));

  let basis = 0;
  let material = 0;
  const prepared = [];
  for (const it of items) {
    const s = byName[it.name];
    if (!s) continue;
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    basis += s.vk * qty;
    material += s.material * qty;
    prepared.push({ service_id: s.id, service_name: s.name, category: s.category, qty, unit_vk: s.vk, unit_material: s.material });
  }
  if (!prepared.length) return { error: 'Positionen nicht im Katalog gefunden.' };

  const ssum = Number(screenshotSum) || 0;
  const factor = ssum > 0 && basis > 0 ? ssum / basis : 1;
  const umsatz = Math.round(basis * factor);
  const material_total = material;
  const reingewinn = umsatz - material_total;
  const r = Number.isFinite(Number(rate)) ? Number(rate) : PROV_DEFAULT;
  const provision = Math.round(reingewinn * r);
  return { prepared, ssum, factor, umsatz, material_total, reingewinn, provision };
}

// ---------------- AUFTRÄGE ----------------
export async function editOrder({ id, customer, orderDate, screenshotSum, items }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  const admin = a.admin;
  if (!id) return { ok: false, error: 'Kein Auftrag gewählt.' };

  const { data: ord, error: oErr } = await admin.from('orders').select('id, mechanic_id, mechanic_name').eq('id', id).single();
  if (oErr || !ord) return { ok: false, error: 'Auftrag nicht gefunden.' };

  // Provisionssatz + aktueller Name des zugehörigen Mechanikers.
  let rate = PROV_DEFAULT;
  let mechName = ord.mechanic_name || null;
  if (ord.mechanic_id) {
    const { data: prof } = await admin.from('profiles').select('name, provision_rate').eq('id', ord.mechanic_id).single();
    if (prof) {
      if (prof.provision_rate != null) rate = Number(prof.provision_rate);
      if (prof.name) mechName = prof.name;
    }
  }

  const c = await recompute(admin, items, screenshotSum, rate);
  if (c.error) return { ok: false, error: c.error };

  const upd = {
    customer: customer || '',
    order_date: orderDate || new Date().toISOString().slice(0, 10),
    screenshot_sum: c.ssum || null,
    adjust_factor: Number(c.factor.toFixed(4)),
    umsatz: c.umsatz,
    material_total: c.material_total,
    reingewinn: c.reingewinn,
    provision: c.provision,
  };
  if (mechName) upd.mechanic_name = mechName;

  const { error: uErr } = await admin.from('orders').update(upd).eq('id', id);
  if (uErr) return { ok: false, error: uErr.message };

  // Positionen ersetzen.
  await admin.from('order_items').delete().eq('order_id', id);
  const rows = c.prepared.map((p) => ({ ...p, order_id: id }));
  const { error: iErr } = await admin.from('order_items').insert(rows);
  if (iErr) return { ok: false, error: iErr.message };

  return { ok: true, umsatz: c.umsatz, provision: c.provision };
}

export async function deleteOrder({ id }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  if (!id) return { ok: false, error: 'Kein Auftrag gewählt.' };
  // Positionen zuerst (unabhängig vom FK-Verhalten), dann den Auftrag.
  await a.admin.from('order_items').delete().eq('order_id', id);
  const { error } = await a.admin.from('orders').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------- AUSGABEN ----------------
export async function addExpense({ date, description, amount }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  const amt = Math.round(Number(amount) || 0);
  if (!String(description || '').trim() || amt <= 0) return { ok: false, error: 'Beschreibung und Betrag angeben.' };
  const { error } = await a.admin.from('expenses').insert({
    expense_date: date || new Date().toISOString().slice(0, 10),
    description: String(description).trim(),
    amount: amt,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function editExpense({ id, date, description, amount }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  if (!id) return { ok: false, error: 'Keine Ausgabe gewählt.' };
  const amt = Math.round(Number(amount) || 0);
  if (!String(description || '').trim() || amt <= 0) return { ok: false, error: 'Beschreibung und Betrag angeben.' };
  const { error } = await a.admin.from('expenses').update({
    expense_date: date || new Date().toISOString().slice(0, 10),
    description: String(description).trim(),
    amount: amt,
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteExpense({ id }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  if (!id) return { ok: false, error: 'Keine Ausgabe gewählt.' };
  const { error } = await a.admin.from('expenses').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------- VERTRÄGE ----------------
function contractPayload(f) {
  return {
    name: String(f.name || '').trim(),
    contact: String(f.contact || '').trim(),
    status: f.status === 'beendet' ? 'beendet' : 'aktiv',
    date_from: f.date_from || null,
    date_to: f.date_to || null,
    deposited: Math.round(Number(f.deposited) || 0),
    notes: String(f.notes || '').trim(),
  };
}

export async function addContract(f) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  const p = contractPayload(f || {});
  if (!p.name) return { ok: false, error: 'Familie/Firma angeben.' };
  const { error } = await a.admin.from('contracts').insert(p);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function editContract(f) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  if (!f || !f.id) return { ok: false, error: 'Kein Vertrag gewählt.' };
  const p = contractPayload(f);
  if (!p.name) return { ok: false, error: 'Familie/Firma angeben.' };
  const { error } = await a.admin.from('contracts').update(p).eq('id', f.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteContract({ id }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  if (!id) return { ok: false, error: 'Kein Vertrag gewählt.' };
  const { error } = await a.admin.from('contracts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------- PROVISIONS-ABRECHNUNG ----------------
export async function savePayout({ mechanicId, periodKey, bonus, paid }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const a = needAdmin();
  if (a.error) return { ok: false, error: a.error };
  if (!mechanicId || !periodKey) return { ok: false, error: 'Mechaniker/Zeitraum fehlt.' };
  const row = {
    mechanic_id: mechanicId,
    period_key: periodKey,
    bonus: Math.round(Number(bonus) || 0),
    paid: !!paid,
    paid_at: paid ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await a.admin.from('provision_payouts').upsert(row, { onConflict: 'mechanic_id,period_key' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
