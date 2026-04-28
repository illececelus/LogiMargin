import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;
const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey = 'placeholder-anon-key';

function hasUsableValue(value: string | undefined, placeholders: string[]) {
  return Boolean(value && !placeholders.some(placeholder => value.includes(placeholder)));
}

const keyPlaceholders = ['placeholder', 'your-service-role-key', 'your-anon-key', 'your-publishable-key'];

function firstUsableKey(...values: Array<string | undefined>) {
  return values.find(value => hasUsableValue(value, keyPlaceholders));
}

export const isSupabaseClientConfigured =
  hasUsableValue(supabaseUrl, ['placeholder.supabase.co', 'example.supabase.co', 'your-project.supabase.co']) &&
  hasUsableValue(supabaseAnonKey, ['placeholder', 'your-anon-key']);

export function isSupabaseServerConfigured() {
  const key = firstUsableKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY
  );
  return (
    hasUsableValue(process.env.NEXT_PUBLIC_SUPABASE_URL, ['placeholder.supabase.co', 'example.supabase.co', 'your-project.supabase.co']) &&
    Boolean(key)
  );
}

export const supabase = createClient(
  supabaseUrl ?? placeholderUrl,
  supabaseAnonKey ?? placeholderKey
);

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = firstUsableKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY
  );

  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured');
  }

  return createClient(url, key);
}
