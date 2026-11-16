'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireLeitung } from '@/lib/guards';

// Sichtbarkeit auf der oeffentlichen Team-Seite setzen (Manager, WL, Inhaber).
export async function setTeamVisibility({ profileId, show }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!profileId) return { ok: false, error: 'Kein Mitarbeiter gewählt.' };
  const { error } = await admin.from('profiles').update({ show_on_team: !!show }).eq('id', profileId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Foto setzen oder entfernen (url null = entfernen). Nur Leitung.
export async function setTeamPhoto({ profileId, url }) {
  const chk = await requireLeitung();
  if (chk.error) return { ok: false, error: chk.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Service-Schlüssel fehlt.' };
  if (!profileId) return { ok: false, error: 'Kein Mitarbeiter gewählt.' };
  const { error } = await admin.from('profiles').update({ photo_url: url || null }).eq('id', profileId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
