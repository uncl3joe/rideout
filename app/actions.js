'use server';

import { createClient } from '@/lib/supabase/server';

const PROV = 0.30;

// Speichert einen Auftrag. Die Preise werden serverseitig frisch aus der
// Datenbank geholt und neu gerechnet – der Client kann keine Beträge fälschen.
export async function saveOrder({ customer, orderDate, screenshotSum, items }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt.' };
  if (!items || !items.length) return { ok: false, error: 'Keine Positionen im Auftrag.' };

  // Eigener Provisionssatz + Name (für den Namens-Schnappschuss am Auftrag).
  const { data: me } = await supabase.from('profiles').select('name, provision_rate').eq('id', user.id).single();
  const rate = me?.provision_rate != null ? Number(me.provision_rate) : PROV;

  const names = items.map((i) => i.name);
  const { data: svc, error: svcErr } = await supabase
    .from('services')
    .select('id, name, category, vk, material')
    .in('name', names);
  if (svcErr) return { ok: false, error: svcErr.message };

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
    prepared.push({
      service_id: s.id,
      service_name: s.name,
      category: s.category,
      qty,
      unit_vk: s.vk,
      unit_material: s.material,
    });
  }
  if (!prepared.length) return { ok: false, error: 'Positionen nicht im Katalog gefunden.' };

  const ssum = Number(screenshotSum) || 0;
  const factor = ssum > 0 && basis > 0 ? ssum / basis : 1;
  const umsatz = Math.round(basis * factor);
  const reingewinn = umsatz - material;
  // Provision nie negativ: bei Verlust (Reingewinn <= 0) bekommt der Mechaniker 0, keine Minus-Provision.
  const provision = Math.max(0, Math.round(reingewinn * rate));

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      mechanic_id: user.id,
      mechanic_name: me?.name || null,
      customer: customer || '',
      order_date: orderDate || new Date().toISOString().slice(0, 10),
      screenshot_sum: ssum || null,
      adjust_factor: Number(factor.toFixed(4)),
      umsatz,
      material_total: material,
      reingewinn,
      provision,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  const rows = prepared.map((p) => ({ ...p, order_id: order.id }));
  const { error: e2 } = await supabase.from('order_items').insert(rows);
  if (e2) return { ok: false, error: e2.message };

  return { ok: true, umsatz, provision };
}
