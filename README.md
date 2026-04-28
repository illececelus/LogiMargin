# LogiMargin — Smart Freight Intelligence

Financial intelligence and smart factoring for Texas owner-operators.

## Stack
- **Next.js 15** (Turbopack)
- **Supabase** — Auth + Postgres
- **Claude API** — AI freight audit
- **shadcn/ui** + Tailwind CSS
- **TanStack Query v5**

## Modules
1. **Load Analyzer** — Go/no-go verdict with LogiMargin Score
2. **Factoring Portal** — AI invoice auditing via Claude
3. **Mechanic's Eye** — Predictive maintenance from CPM spikes
4. **Detention Stopwatch** — Auto-generates legal claim letters
5. **IFTA Smart Logger** — Quarterly tax aggregation by state

## Setup

```bash
git clone https://github.com/illececelus/attack.git
cd attack
git checkout claude/logimargin-mvp-setup-UQaos
npm install
cp .env.example .env.local
# Fill in .env.local with your Supabase + Anthropic keys
npm run dev
```

Run the SQL in `supabase/schema.sql` in your Supabase Dashboard → SQL Editor. This creates the app tables, RLS policies, `broker_scores` view, `profiles` auto-bootstrap trigger, and `logistics_docs` storage bucket/policies required for saving data.

### Supabase connection

Use real Supabase values in `.env.local`; placeholder values are intentionally treated as "not configured":

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Optional anonymous session bootstrap is enabled by default so the MVP can save trips, maintenance records, detention records, and uploaded drafts without a dedicated login screen. Set `NEXT_PUBLIC_SUPABASE_AUTO_ANON=false` if you want to require an existing Supabase Auth session.

## Build
```bash
npm run build
npm run type-check
```
