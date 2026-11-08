import { createClient } from '@/lib/supabase/server';
import Shop from '@/components/Shop';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ride Out Customs – Fahrzeuge',
  description: 'Fahrzeugangebote von Ride Out Customs',
};

// Öffentliche Kundenseite (ohne Login). Liest die Fahrzeuge anonym per RLS.
export default async function ShopPage() {
  const supabase = createClient();
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, model, price, seller_name, status, image_url, reserve_24h, created_at')
    .order('created_at', { ascending: false });

  return <Shop vehicles={vehicles || []} />;
}
