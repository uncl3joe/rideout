'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ROLES = ['praktikant', 'mechaniker', 'manager', 'werkstattleitung', 'inhaber'];

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
  await admin.from('profiles').update({ name: name || '', role: r }).eq('id', data.user.id);
  return { ok: true };
}

export async function deleteMechanic({ id }) {
  const chk = await requireInhaber();
  if (chk.error) return { ok: false, error: chk.error };
  if (id === chk.user.id) return { ok: false, error: 'Du kannst dich nicht selbst löschen.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt (SUPABASE_SERVICE_ROLE_KEY in Vercel eintragen).' };

  // Den letzten Inhaber schützen.
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).single();
  if (target?.role === 'inhaber') {
    const { data: inh } = await admin.from('profiles').select('id').eq('role', 'inhaber');
    if ((inh || []).length <= 1) return { ok: false, error: 'Den letzten Inhaber kann man nicht löschen.' };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
