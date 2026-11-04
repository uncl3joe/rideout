import { createClient } from '@supabase/supabase-js';

// Service-Role-Client: hat volle Rechte und umgeht RLS.
// NUR serverseitig verwenden (Server Actions), niemals im Browser.
// Gibt null zurück, wenn kein Service-Schlüssel gesetzt ist.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
