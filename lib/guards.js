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
