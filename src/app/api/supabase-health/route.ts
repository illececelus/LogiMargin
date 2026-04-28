import { NextResponse } from 'next/server';
import { createServerClient, isSupabaseServerConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        ok: false,
        message: 'Supabase environment variables are not configured.',
      },
      { status: 503 }
    );
  }

  try {
    const db = createServerClient();
    const { error } = await db.from('profiles').select('id').limit(1);
    if (error) throw error;

    return NextResponse.json({
      configured: true,
      ok: true,
      message: 'Supabase connection is ready.',
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        ok: false,
        message: err instanceof Error ? err.message : 'Supabase connection failed.',
      },
      { status: 500 }
    );
  }
}
