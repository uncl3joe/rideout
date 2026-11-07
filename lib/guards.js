import { createClient } from '@/lib/supabase/server';

// Prüft über die (echte) Session, dass der aufrufende Nutzer Inhaber ist.
// Wird von den geschützten Server-Actions benutzt.
export async function requireInhaber() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: 'Nicht eingeloggt.' };
  const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (prof?.role !== 'inhaber') return { error: 'Nur der Inhaber darf das.' };
  return { user };
}

// Prüft, dass der aufrufende Nutzer auf Leitungsebene ist (Manager, WL, Inhaber).
export async function requireLeitung() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: 'Nicht eingeloggt.' };
  const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (!['manager', 'werkstattleitung', 'inhaber'].includes(prof?.role)) {
    return { error: 'Nur die Leitungsebene darf das.' };
  }
  return { user };
}
