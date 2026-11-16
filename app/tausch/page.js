import { createClient } from '@/lib/supabase/server';
import Tausch from '@/components/Tausch';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tauschbörse · Ride Out Customs',
  description: 'Auto gegen Auto: Biete dein Fahrzeug und finde deinen Tausch, direkt mit anderen.',
};

// Oeffentliche Tauschbörse. Liest die aktiven Inserate anonym über die
// oeffentliche Ansicht public_trades (genau wie Shop, Auktion, Team).
export default async function TauschPage() {
  const sb = createClient();
  const { data } = await sb
    .from('public_trades')
    .select('id, first_name, last_name, phone, offer_model, offer_image, seek_text, seek_image, created_at, expires_at')
    .order('created_at', { ascending: false });

  return <Tausch listings={data || []} />;
}
