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

Run the SQL in `supabase/schema.sql` in your Supabase Dashboard → SQL Editor.

## Build
```bash
npm run build
npm run type-check
```

## Automation

- `npm run maintenance` runs linting, TypeScript checks, and a high-severity production dependency audit.
- `npm run app:builder` runs linting, TypeScript checks, and the Next.js production build.
- `npm run app:autopilot` applies safe production audit fixes to the lockfile, reinstalls dependencies, and rebuilds the app.
- GitHub Actions runs app builder automation on pushes and pull requests.
- GitHub Actions runs daily maintenance automation every hour from 23:00 through 05:00 UTC and can also be started manually.
- GitHub Actions runs nightly autopilot automation in the same UTC window. When it can safely improve dependencies and the app still passes checks, it opens a pull request from `cursor/nightly-app-autopilot-113c` automatically.
