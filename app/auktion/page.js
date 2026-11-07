import { createClient } from '@/lib/supabase/server';
import AuktionPublic from '@/components/AuktionPublic';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ride Out Customs – Auktionen',
  description: 'Live-Auktionen von Ride Out Customs',
};

// Öffentliche Auktionsseite (ohne Login). Liest anonym per RLS; der Rest
// kommt live über Supabase Realtime im Client.
export default async function AuktionPage() {
  const supabase = createClient();
  const { data: auctions } = await supabase
    .from('auctions')
    .select('id, model, image_url, start_price, min_increment, current_bid, current_bid_ic, last_bid_at, ends_at, status, winner_ic, created_at')
    .order('created_at', { ascending: false });

  const ids = (auctions || []).map((a) => a.id);
  let bids = [];
  if (ids.length) {
    const { data } = await supabase
      .from('bids')
      .select('id, auction_id, ic_name, amount, created_at')
      .in('auction_id', ids)
      .order('amount', { ascending: false });
    bids = data || [];
  }

  return <AuktionPublic initialAuctions={auctions || []} initialBids={bids} />;
}
