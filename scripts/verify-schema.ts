import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

type CheckStatus = 'ok' | 'missing' | 'error' | 'unknown';
type QueryError = { code?: string; message: string };
type SchemaClient = {
  from(table: string): {
    select(columns: string, options?: { count?: 'exact'; head?: boolean }): {
      limit(count: number): Promise<{ error: QueryError | null }>;
    };
  };
  storage: {
    getBucket(id: string): Promise<{ data: unknown; error: QueryError | null }>;
  };
};

type CheckResult = {
  name: string;
  status: CheckStatus;
  detail?: string;
};

const REQUIRED_TABLES = [
  'profiles',
  'organizations',
  'trips',
  'invoices',
  'brokers',
  'vehicle_vitals',
  'detention_records',
  'load_drafts',
  'load_documents',
  'ifta_trip_legs',
  'maintenance_events',
  'notifications',
  'audit_logs',
  'subscriptions',
] as const;

const REQUIRED_RLS_TABLES = [
  ...REQUIRED_TABLES,
  'trucks',
  'trailers',
  'drivers',
  'trip_stops',
] as const;

const REQUIRED_BUCKET = 'logistics-docs';

const CREATE_SQL: Record<string, string> = {
  organizations: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create organizations and multi-tenant tables.',
  trucks: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create trucks.',
  trailers: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create trailers.',
  drivers: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create drivers.',
  trip_stops: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create trip_stops.',
  maintenance_events: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create maintenance_events.',
  notifications: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create notifications.',
  audit_logs: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create audit_logs.',
  subscriptions: 'Run supabase/migrations/20260428000000_v2_full_schema.sql to create subscriptions.',
};

function usable(value: string | undefined, placeholders: string[]) {
  return Boolean(value && !placeholders.some(placeholder => value.includes(placeholder)));
}

function loadDotEnvLocal() {
  const path = '.env.local';
  try {
    if (!existsSync(path)) return;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (!process.env[key]) {
        process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // Keep the script dependency-free; explicit env vars still work.
  }
}

function env() {
  loadDotEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!usable(url, ['placeholder.supabase.co', 'example.supabase.co', 'your-project.supabase.co'])) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing or still a placeholder.');
  }
  if (!usable(serviceKey, ['placeholder', 'your-service-role-key'])) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for schema verification.');
  }
  return { url: url!, serviceKey: serviceKey! };
}

async function checkTable(client: SchemaClient, table: string): Promise<CheckResult> {
  const { error } = await client.from(table).select('*', { count: 'exact', head: true }).limit(1);
  if (!error) return { name: table, status: 'ok' };
  if (error.code === '42P01' || error.message.toLowerCase().includes('does not exist')) {
    return { name: table, status: 'missing', detail: CREATE_SQL[table] ?? `Create table "${table}" from supabase/schema.sql.` };
  }
  return { name: table, status: 'error', detail: `${error.code ?? 'unknown'}: ${error.message}` };
}

async function checkRls(table: string): Promise<CheckResult> {
  return {
    name: table,
    status: 'unknown',
    detail: `Inspect manually with: select relrowsecurity from pg_class where oid = 'public.${table}'::regclass;`,
  };
}

async function checkBucket(client: SchemaClient): Promise<CheckResult> {
  const { data, error } = await client.storage.getBucket(REQUIRED_BUCKET);
  if (!error && data) return { name: REQUIRED_BUCKET, status: 'ok' };
  return {
    name: REQUIRED_BUCKET,
    status: 'missing',
    detail: `Create storage bucket "${REQUIRED_BUCKET}" or run the v2 migration. Current error: ${error?.message ?? 'not found'}`,
  };
}

function printSection(title: string, rows: CheckResult[]) {
  console.log(`\n## ${title}`);
  for (const row of rows) {
    const marker = row.status === 'ok' ? '[ok]' : row.status === 'missing' ? '[missing]' : row.status === 'error' ? '[error]' : '[unknown]';
    console.log(`${marker} ${row.name}: ${row.status}${row.detail ? ` - ${row.detail}` : ''}`);
  }
}

async function main() {
  const { url, serviceKey } = env();
  const client = createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as SchemaClient;

  const tableChecks = await Promise.all(REQUIRED_TABLES.map(table => checkTable(client, table)));
  const rlsChecks = await Promise.all(REQUIRED_RLS_TABLES.map(table => checkRls(table)));
  const bucketCheck = await checkBucket(client);

  console.log('# LogiMargin Supabase Schema Verification');
  console.log(`Project URL: ${url}`);
  console.log(`Checked at: ${new Date().toISOString()}`);
  printSection('Tables', tableChecks);
  printSection('RLS', rlsChecks);
  printSection('Storage', [bucketCheck]);

  const hardFailures = [...tableChecks, bucketCheck].filter(row => row.status === 'missing' || row.status === 'error');
  if (hardFailures.length > 0) {
    console.log('\n## Required SQL');
    console.log('Run supabase/migrations/20260428000000_v2_full_schema.sql in Supabase SQL Editor, then run this script again.');
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Schema verification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
