# Loom — Project Context

Reference doc for anyone (human or Claude) picking up work on Loom without
the history of how it got here. Written for a Claude Project's knowledge
base — keep it updated as architecture decisions change, don't let it drift
into a changelog.

## What Loom is

An innovation-facilitation tool for Struinova Innovation. The product
follows a fabric-creation metaphor throughout, and the vocabulary is load-
bearing — use it consistently:

- **Loom** — the platform itself (the thing that creates fabric).
- **Thread** — a customer question / line of inquiry. Each thread has one
  active working question (versioned — a thread can be re-framed, bumping
  its question version) and a tree of knots hanging off it.
- **Knot** — a single provocation/idea, produced either by "pulling" from a
  creative technique (first principles, reframe, invert, outsider view,
  analogous, scope shift, absence, forced collision, found out, night
  shift, fiber) or added manually as a plain "note" knot.
- **Pull** — the action of generating new knot(s) from a source (the
  question itself, or an existing knot), via a server-side call to the
  Anthropic API.
- Facilitation approach follows the Basadur 8-Step CPS ("Simplexity")
  process and HMW Collective's "connection before content" principle —
  see the `basadur-cps-methodology` skill if working on agenda/workshop
  design specifically.

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, TypeScript.
- **Supabase** (Postgres 17) — auth, multi-tenant RLS, realtime not yet
  used. Project name **Loom**, org **Woodsage Partners**, project ref
  `ulszwbcnqmdebbssdtek`, region `us-east-1`.
- **@xyflow/react** (v12) — the canvas. Controlled nodes/edges, custom
  layout (not xyflow's auto-layout).
- **Vercel** — deploy target, connected to
  `github.com/WoodsagePartners/Loom.git` (branch `main`). Build shows a
  `build {commit-sha}` tag in the app's top bar (from
  `process.env.VERCEL_GIT_COMMIT_SHA`) specifically so a stale browser vs.
  a stale deployment is diagnosable at a glance.
- Anthropic API calls are server-side only (`/api/pull`, `/api/trace`) —
  the key is never exposed to the browser.

## Data model — tree today, DAG-hedged for tomorrow

Knots live in `nodes`, one row per knot, with a single `parent_id`
self-reference. That's a **tree**: every knot has exactly one parent, and
`lib/layout.ts`'s `layoutThread()` walks it to assign depth (column) and
row (vertical slot) for the canvas.

We deliberately did **not** move to a graph database when the DAG question
came up. Reasoning: at current scale (dozens to low hundreds of knots per
thread), Postgres with an adjacency-list table is the right tool — it
comes with RLS-scoped multi-tenancy and auth already built in, and a
second database (Neo4j etc.) would mean losing that and hand-rolling sync
for a problem the product doesn't have yet.

What *would* justify a real DAG: a "combine two lines of inquiry into one
synthesis knot" feature — a knot with more than one parent. That's a
concrete, plausible feature (creative convergence/synthesis is part of
CPS), so the schema was hedged for it early rather than retrofitted later:

- **`node_edges`** table added (migration `add_node_edges`): `thread_id`,
  `from_node_id`, `to_node_id`, `relation`. RLS mirrors `nodes`. Backfilled
  1:1 from every existing `parent_id` relationship.
- `parent_id` is untouched and still drives layout — `node_edges` only
  carries anything *beyond* that one primary parent.
- `lib/layout.ts` exports `secondaryEdges(nodes, edges)` — every edge row
  not already implied by `parent_id` — and `thread-canvas.tsx` renders
  those as dashed cyan wires, distinct from the primary weave.
- Nothing writes extra rows into `node_edges` yet — there's no "Combine"
  UI. This is groundwork only: schema and rendering are ready, so adding
  the actual multi-select-and-merge feature later is additive, not a
  migration.
- If/when actual graph-algorithm needs show up (pattern matching across
  arbitrary paths, "which technique most often precedes a kept idea"),
  the incremental next step is **Apache AGE** (Cypher inside Postgres) or
  **pgvector** for similarity search — not a platform swap.

## Local dev setup

`.env.local` is gitignored — copy `.env.local.example` and fill in real
values (Supabase URL + publishable key are already real/public in the
example; `ANTHROPIC_API_KEY` is a secret you get from
console.anthropic.com and fill in yourself, never paste it to an
assistant).

Known gotcha: `@supabase/supabase-js` pulled in a broken transitive
dependency on `iceberg-js` (Supabase's new Apache Iceberg client) in some
recent patch versions, before their build-system fix landed. If a fresh
`npm install` throws `Module not found: Can't resolve 'iceberg-js'`, fix
is `npm install iceberg-js` (harmless — Loom doesn't use Iceberg storage,
it just satisfies the bundler's resolution).

Standard verify-before-push workflow: `npm run build` clean, then git
add/commit/push. Never trust `npm run dev`'s Turbopack output alone for
this — its cache can go stale relative to a fresh `node_modules`.

## Backlog / not yet built

- Auth + org flows (beyond the current single-org assumption)
- Server-side Anthropic API routes hardening
- Org document upload (context priming)
- Shared/customizable technique knowledge base (Skills Library)
- Thread composer with the starting-point framework (currently disabled
  placeholders in the rail: prevent recurrence, innovate for new, new
  business, respond to threat, exploit signal, constraint removal,
  decision fork, mandate-triggered)
- Combine/Synthesize UI — the actual feature `node_edges` was built for
- Left-rail placeholder icons not yet wired up: Settings (admin/users/
  billing), Archive (save canvas snapshot), Export PDF, Upload content,
  Skills library
