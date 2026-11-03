import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase-Client fürs Server-Rendering (Server Components, Server Actions).
// Liest/schreibt die Session über Cookies.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components kann nicht geschrieben werden – die
            // Middleware erneuert die Session, daher ist das hier ok.
          }
        },
      },
    }
  );
}
