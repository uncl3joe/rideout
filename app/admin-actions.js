'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ROLES = ['praktikant', 'mechaniker', 'manager', 'werkstattleitung', 'inhaber'];
const BAN_FOREVER = '876000h'; // ~100 Jahre = dauerhaft gesperrt

// Prüft, dass der aufrufende Nutzer wirklich Inhaber ist (über seine Session).
async function requireInhaber() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: 'Nicht eingeloggt.' };
  const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (prof?.role !== 'inhaber') return { error: 'Nur Inhaber dürfen Mitarbeiter verwalten.' };
  return { user };
}

// Verhindert, dass der letzte Inhaber gesperrt/gelöscht wird.
async function guardLastInhaber(admin, id) {
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).single();
  if (target?.role === 'inhaber') {
    const { data: inh } = await admin.from('profiles').select('id').eq('role', 'inhaber').eq('active', true);
    if ((inh || []).length <= 1) return 'Den letzten aktiven Inhaber kann man nicht sperren oder löschen.';
  }
  return null;
}

export async function createMechanic({ name, email, password, role }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt (SUPABASE_SERVICE_ROLE_KEY in Vercel eintragen).' };

  email = String(email || '').trim();
  if (!email || !password) return { ok: false, error: 'E-Mail und Passwort sind nötig.' };
  if (String(password).length < 6) return { ok: false, error: 'Passwort muss mind. 6 Zeichen haben.' };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || '' },
  });
  if (error) return { ok: false, error: error.message };

  const r = ROLES.includes(role) ? role : 'mechaniker';
  await admin.from('profiles').update({ name: name || '', role: r, active: true, archived: false }).eq('id', data.user.id);
  return { ok: true };
}

// Mitarbeiter aktivieren/deaktivieren. Deaktiviert = Login gesperrt, kommt
// zurück, Zahlen bleiben. Aktivieren hebt auch einen Platzhalter wieder auf.
export async function setMechanicActive({ id, active }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  if (id === chk.user.id) return { ok: false, error: 'Du kannst dich nicht selbst sperren.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt (SUPABASE_SERVICE_ROLE_KEY in Vercel eintragen).' };

  if (!active) {
    const g = await guardLastInhaber(admin, id);
    if (g) return { ok: false, error: g };
  }

  const patch = active ? { active: true, archived: false } : { active: false };
  const { error } = await admin.from('profiles').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Login sperren bzw. wieder freigeben (bricht nicht ab, falls die Auth-API zickt –
  // der Login-Block in der App greift zusätzlich).
  try {
    await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : BAN_FOREVER });
  } catch {}
  return { ok: true };
}

// "Löschen" = Platzhalter. Der Datensatz bleibt als Platzhalter erhalten
// (damit die Zahlen stehen bleiben), der Login wird dauerhaft gesperrt UND
// die E-Mail wird freigegeben (umgehängt), damit dieselbe Adresse später
// wieder für einen neuen Account verwendet werden kann (z. B. Rückkehrer).
export async function deleteMechanicPlaceholder({ id }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  if (id === chk.user.id) return { ok: false, error: 'Du kannst dich nicht selbst löschen.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt (SUPABASE_SERVICE_ROLE_KEY in Vercel eintragen).' };

  const g = await guardLastInhaber(admin, id);
  if (g) return { ok: false, error: g };

  const { error } = await admin.from('profiles').update({ active: false, archived: true }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  // E-Mail des Logins auf eine geparkte, eindeutige Adresse umhängen (gibt die
  // Original-Adresse frei) und dauerhaft sperren.
  let emailFreed = false;
  try {
    const parked = 'ehemalig-' + id + '@former.rideout-customs.app';
    const { error: eErr } = await admin.auth.admin.updateUserById(id, {
      email: parked,
      email_confirm: true,
      ban_duration: BAN_FOREVER,
    });
    if (!eErr) emailFreed = true;
    else await admin.auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER }); // wenigstens sperren
  } catch {}
  return { ok: true, emailFreed };
}

// Provisionssatz (0..1) pro Mechaniker setzen.
export async function setProvisionRate({ id, rate }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt (SUPABASE_SERVICE_ROLE_KEY in Vercel eintragen).' };
  let r = Number(rate);
  if (!Number.isFinite(r)) return { ok: false, error: 'Ungültiger Satz.' };
  r = Math.min(1, Math.max(0, r));
  const { error } = await admin.from('profiles').update({ provision_rate: r }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
