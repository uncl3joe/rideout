import { createAdminClient } from '@/lib/supabase/admin';
import Team from '@/components/Team';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Team · Ride Out Customs',
  description: 'Die Crew hinter Ride Out Customs: Werkstatt, Tuning und Fahrzeughandel.',
};

// Oeffentliche Team-Seite. Liest nur freigeschaltete, aktive Profile und nur die
// oeffentlichen Felder (Name, Rang, Foto) ueber den Service-Client.
export default async function TeamPage() {
  const admin = createAdminClient();
  let members = [];
  if (admin) {
    const { data } = await admin
      .from('profiles')
      .select('name, role, photo_url, active')
      .eq('show_on_team', true)
      .order('name');
    members = (data || [])
      .filter((m) => m.active !== false)
      .map(({ active, ...m }) => m);
  }
  return <Team members={members} />;
}
