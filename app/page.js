import { createClient } from '@/lib/supabase/server';
import Landing from '@/components/Landing';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ride Out Customs',
  description: 'Werkstatt, Tuning und Fahrzeughandel bei Ride Out Customs. Kaufen, ersteigern oder tauschen.',
};

// Oeffentliche Startseite (ohne Login). Zeigt leichte Live-Infos (Bestand, Auktion).
export default async function Home() {
  const sb = createClient();
  let vehicleCount = 0;
  let auctionLive = false;
  try {
    const { count } = await sb.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'verfuegbar');
    vehicleCount = count || 0;
    const { data: live } = await sb.from('auctions').select('id').eq('status', 'live').limit(1);
    auctionLive = (live || []).length > 0;
  } catch {
    /* Startseite rendert auch ohne Live-Zahlen */
  }
  return <Landing vehicleCount={vehicleCount} auctionLive={auctionLive} />;
}
