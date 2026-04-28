import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function assertSupabaseEnv() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and publishable key are required.');
  }
}

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  assertSupabaseEnv();
  const url = supabaseUrl!;
  const key = supabaseKey!;
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot set cookies; middleware keeps sessions refreshed.
          }
        },
      },
    }
  );
};
