# Running the Next.js build

## 1. Install dependencies
```
npm install
```

## 2. Environment
```
copy .env.local.example .env.local
```
Then open `.env.local` and paste in your real `ANTHROPIC_API_KEY`. The
Supabase URL and publishable key are already filled in — they're safe to
commit-adjacent (publishable, not secret), but `.env.local` itself stays
gitignored regardless.

## 3. Run it
```
npm run dev
```
Opens on http://localhost:3000. First visit redirects to `/login`, which
sends a magic link (check email, click it, you land on `/onboarding` to
name your first workspace, then `/dashboard`).

## What's wired up so far
- **Auth**: Supabase magic-link sign-in, session refreshed via middleware
  on every request.
- **Multi-tenant data**: `orgs` / `memberships` tables, every other table
  (`threads`, `nodes`, `fibers`, `ledger_entries`, `library_techniques`,
  `job_queue`, `proposed_threads`) scoped by Postgres row-level security to
  the org you belong to. Nothing bypasses this — even a leaked publishable
  key can't read another org's data.
- **Server-side model calls**: `/api/pull` proxies Anthropic. The API key
  lives in `.env.local` server-side only, never shipped to the browser.
- **Dashboard**: reads live threads from Supabase for your org. Bare right
  now — the canvas (nodes, wires, telemetry strip, walkthrough) from
  `the-loom.html` still needs porting into React components here.

## What's still open
- Canvas UI port (nodes/wires/dock/inspector/ledger/library modals) from
  `the-loom.html` into `app/dashboard`.
- Invite flow (the `invites` table exists, no UI yet).
- Fact-finding / night-shift / scribe API routes (only `/api/pull` is
  built; the other three system prompts from `the-loom.html` need the
  same server-side treatment).

## Deploying
This is a standard Next.js App Router project — deploys to Vercel with
zero config once you connect the repo. Set the same three env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`ANTHROPIC_API_KEY`) in the Vercel project settings.
