import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  // Deaktivierte/gelöschte Mitarbeiter sofort ausloggen. Bewusst als eigener,
  // fehlertoleranter Check: fehlt die Spalte (SQL noch nicht eingespielt),
  // bleibt der Login/die Rolle unangetastet. Kein try/catch um redirect().
  const { data: act, error: actErr } = await supabase
    .from('profiles')
    .select('active')
    .eq('id', user.id)
    .single();
  if (!actErr && act && act.active === false) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, name, category, vk, material')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('vk', { ascending: false });

  const safeProfile = {
    id: user.id,
    name: profile?.name || user.email,
    role: profile?.role || 'mechaniker',
    email: user.email,
  };

  return <Shell profile={safeProfile} services={services || []} />;
}
