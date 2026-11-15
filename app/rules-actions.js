'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireInhaber } from '@/lib/guards';
import { RULES_DEFAULT } from '@/lib/rules-default';

async function loadDoc(admin) {
  let { data: row } = await admin.from('rules_doc').select('version, data, updated_at').eq('id', 1).single();
  if (!row) {
    await admin.from('rules_doc').upsert({ id: 1, version: 1, data: RULES_DEFAULT }, { onConflict: 'id', ignoreDuplicates: true });
    const r2 = await admin.from('rules_doc').select('version, data, updated_at').eq('id', 1).single();
    row = r2.data;
  }
  return row;
}

// Aktuelles Regel-Dokument + ob der eingeloggte Nutzer die aktuelle Version bestätigt hat.
export async function getRulesStatus() {
  const chk = await requireUser();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };

  const row = await loadDoc(admin);
  const { data: acc } = await admin
    .from('rules_acceptances')
    .select('version')
    .eq('profile_id', chk.user.id)
    .eq('version', row.version)
    .maybeSingle();

  return {
    ok: true,
    version: row.version,
    doc: row.data,
    updatedAt: row.updated_at,
    accepted: !!acc,
    isInhaber: chk.role === 'inhaber',
  };
}

// Bestätigung des eingeloggten Nutzers für die aktuelle Version speichern.
export async function acceptRules({ version }) {
  const chk = await requireUser();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!version) return { ok: false, error: 'Keine Version.' };
  const { error } = await admin
    .from('rules_acceptances')
    .upsert({ profile_id: chk.user.id, version, accepted_at: new Date().toISOString() }, { onConflict: 'profile_id,version' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Regeln speichern (nur Inhaber). bumpVersion=true -> alle müssen erneut bestätigen.
export async function saveRules({ data, bumpVersion }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!data || typeof data !== 'object' || !Array.isArray(data.sections)) {
    return { ok: false, error: 'Ungültige Regel-Daten.' };
  }
  const { data: cur } = await admin.from('rules_doc').select('version').eq('id', 1).single();
  const curVer = cur?.version || 1;
  const version = bumpVersion ? curVer + 1 : curVer;
  const { error } = await admin
    .from('rules_doc')
    .upsert({ id: 1, version, data, updated_at: new Date().toISOString(), updated_by: chk.user.id }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true, version };
}

// Protokoll: wer hat die aktuelle Version bestätigt (nur Inhaber).
export async function listAcceptances() {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  const { data: doc } = await admin.from('rules_doc').select('version').eq('id', 1).single();
  const version = doc?.version || 1;
  const { data: profs } = await admin.from('profiles').select('id, name, role').order('name');
  const { data: accs } = await admin.from('rules_acceptances').select('profile_id, accepted_at').eq('version', version);
  const map = {};
  for (const a of accs || []) map[a.profile_id] = a.accepted_at;
  const list = (profs || [])
    .filter((p) => p.role)
    .map((p) => ({ id: p.id, name: p.name, role: p.role, accepted_at: map[p.id] || null }));
  return { ok: true, version, list };
}
