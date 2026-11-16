import { createClient } from '@/lib/supabase/server';
import Team from '@/components/Team';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Team · Ride Out Customs',
  description: 'Die Crew hinter Ride Out Customs: Werkstatt, Tuning und Fahrzeughandel.',
};

// Oeffentliche Team-Seite. Liest die oeffentliche Ansicht public_team (nur Name,
// Rang, Foto der freigeschalteten, aktiven Mitarbeiter) anonym, genau wie Shop/Auktion.
export default async function TeamPage() {
  const sb = createClient();
  const { data } = await sb.from('public_team').select('name, role, photo_url').order('name');
  return <Team members={data || []} />;
}
