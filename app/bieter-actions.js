'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';
import { BAN_KINDS, normBanValue } from '@/lib/bans';

// ---------------- Daten fuer den Bieter-Check (nur Leitung) ----------------
// Liest alles serverseitig mit Service-Key, damit die Auswertung nicht von
// RLS-Rechten im Browser abhaengt und die Sperrliste mitkommt.
export async function getBieterData() {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Server ist nicht konfiguriert.' };

  const [a, b, c, d] = await Promise.all([
    admin.from('auctions').select('id, model, status, current_bid_ic, winner_ic'),
    admin.from('bids').select('id, auction_id, ic_name, amount, created_at'),
    admin.from('bid_contacts').select('bid_id, discord_name, ip, device'),
    admin.from('bid_bans').select('id, kind, value, reason, created_by, created_at'),
  ]);

  return {
    ok: true,
    auctions: a.data || [],
    bids: b.data || [],
    contacts: c.data || [],
    bans: d.data || [],
  };
}

async function leitungName(admin, userId) {
  try {
    const { data: prof } = await admin.from('profiles').select('name').eq('id', userId).single();
    return prof?.name || null;
  } catch {
    return null;
  }
}

// ---------------- Sperre hinzufuegen ----------------
export async function addBan({ kind, value, reason }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };

  kind = String(kind || '').trim();
  if (!BAN_KINDS.includes(kind)) return { ok: false, error: 'Unbekannter Sperr-Typ.' };
  const v = normBanValue(kind, value);
  if (!v) return { ok: false, error: 'Bitte einen Wert angeben.' };
  if (v.length > 120) return { ok: false, error: 'Wert zu lang.' };
  const rsn = String(reason || '').trim().slice(0, 200) || null;

  const by = await leitungName(admin, chk.user.id);
  const { error } = await admin
    .from('bid_bans')
    .upsert({ kind, value: v, reason: rsn, created_by: by }, { onConflict: 'kind,value' });
  if (error) return { ok: false, error: 'Konnte nicht sperren.' };
  return { ok: true };
}

// ---------------- Mehrere Sperren auf einmal (z. B. ganze Gruppe) ----------------
export async function addBans({ items }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Nichts zu sperren.' };

  const by = await leitungName(admin, chk.user.id);
  const seen = new Set();
  const rows = [];
  for (const it of items.slice(0, 200)) {
    const kind = String(it?.kind || '').trim();
    if (!BAN_KINDS.includes(kind)) continue;
    const v = normBanValue(kind, it?.value);
    if (!v || v.length > 120) continue;
    const key = kind + ':' + v;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ kind, value: v, reason: String(it?.reason || '').trim().slice(0, 200) || null, created_by: by });
  }
  if (rows.length === 0) return { ok: false, error: 'Nichts Gültiges zu sperren.' };

  const { error } = await admin.from('bid_bans').upsert(rows, { onConflict: 'kind,value' });
  if (error) return { ok: false, error: 'Konnte nicht sperren.' };
  return { ok: true, count: rows.length };
}

// ---------------- Sperre aufheben ----------------
export async function removeBan({ id }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!id) return { ok: false, error: 'Keine Sperre gewählt.' };

  const { error } = await admin.from('bid_bans').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
