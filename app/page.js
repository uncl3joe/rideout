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

  const { data: services } = await supabase
    .from('services')
    .select('id, name, category, vk, material')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('vk', { ascending: false });

  const safeProfile = {
    name: profile?.name || user.email,
    role: profile?.role || 'mechaniker',
    email: user.email,
  };

  return <Shell profile={safeProfile} services={services || []} />;
}
