# GitGrill — Demo → Product: Identity, Metering & Monetization Architecture

> **Status:** FINAL v1.0 · October 2026
> **Relationship to other docs:** This is the source of truth for Milestones 24–25 and
> supersedes `DEVELOPER_CAREER_OS_IDEATION.md` §3 where they differ (ideation §3.4 landing
> repositioning still applies). Executable sub-milestones + acceptance criteria live in
> `MONETIZATION_BUILD_TRACKER.md`; overall history stays in `BUILD_TRACKER.md`.

---

## 0. Where we are (the honest state)

What exists today is a **great demo**:

| Layer | Current state | Gap |
|---|---|---|
| Identity | None. Recruiter identity is a hardcoded local persona (`recruiter-auth.ts` — "Sarah Chen, Pro seat"); developer identity is a bare `githubUsername` string in localStorage | Real accounts, one per human, switchable contexts |
| Metering | None. `GET /api/agent/stream` is anonymous and unmetered; `force`/`jd` runs always hit the LLM | Usage ledger; every expensive run recorded and attributable |
| Gating | None. Every capability is available to everyone | Capability/tier registry; limits per tier |
| Billing | None | Bangladesh MFS (bKash & Nagad) + 24h provisional activation |
| Isolation | None. All state is one browser's localStorage | Per-user workspaces with enforced red lines |

The demo itself is an asset — it is the top of funnel. The goal is **not** to remove it but
to **bound and label** it, then build the product layers underneath.

---

## 1. The golden rule

**Enforce where money is spent (server-side). Gate where value is delivered (UX-side).
Never trust the client for cost.**

- There is exactly **one real cost chokepoint** today: `GET /api/agent/stream` (each fresh
  audit is an LLM call; ~$0.01–0.05 at flash-class pricing).
- Everything else (target roles, practice mode, proof pages) is a *value* gate, not a *cost*
  gate — those can start softer and tighten later.
- Limits must be **data, not code**: one registry consumed by both backend enforcement and
  frontend upsell UI, so "making limits more rigorous" is a config change, never a refactor.

### The three layers (build in this order)

```
IDENTITY  →  METERING  →  GATING & BILLING
who is this?  what have they   what may they do,
              consumed?        and how do they pay?
```

Each layer depends on the one before it. You cannot meter an anonymous stranger; you cannot
bill usage you never recorded.

---

## 2. Chokepoint map (against current code)

| Chokepoint | Current location | Controls | Enforcement (target) |
|---|---|---|---|
| Fresh audit run | `backend/src/routes/api.ts` → `GET /generate` | **The real cost** | Hard, server-side: atomic quota check *before* agent work starts |
| Cached profile read | same route, `readCache` hit | ~zero cost | Free for everyone — cache hits never consume quota |
| Proof publish | `backend/src/proofs/proof.routes.ts` → `PUT /:username/:roleId` | Growth artifact | Auth required; count per user (Free = 1 active) |
| Target roles | localStorage (`devscope_target_roles_v1`) | Campaign scope | Value gate; naturally bounded by audit quota; moves server-side in M24D |
| Defense practice | `DefenseHub` (localStorage) | Retention feature | Feature flag per tier (Free = view bank, Pro = full practice) |
| Recruiter batch screening | `frontend/app/recruiter`, `pipeline` | The revenue engine | Server-side seat check (M25C) |

**Decision (v1 simplification):** the ideation doc proposed a signed short-lived analysis
token. We instead do the **atomic check-and-reserve inside the stream handler before agent
work begins** — same guarantee, less machinery. Revisit signed tokens only if we add
multiple cost entrypoints.

---

## 3. Identity design

**One account per human, two explicit contexts** (mirroring today's workspace switcher):

- **Developer context** — authenticated primarily via **GitHub OAuth**. The GitHub handle
  *is* the product's currency (audits, proof pages, later private-repo proof), so OAuth is
  the natural identity and removes typing-your-handle friction.
- **Recruiter context** — authenticated via **email magic link** (no passwords). Recruiters
  don't necessarily have GitHub; email is the lowest-friction corporate identity.
- **Account linking:** same verified email across providers merges into one `users` row.
  A user may hold both contexts; the UI switches between them explicitly.

**Stack decision:** managed auth + Postgres + row-level security (**Supabase** recommended —
Postgres, magic links, OAuth, and RLS in one). Self-hosted Postgres + custom JWT is the
alternative if vendor independence is required. *Needs sign-off before M24B (see §11).*

**Session mechanics:**
- Supabase issues a JWT; the Express backend verifies the signature with the project secret
  (**no DB hit on the hot path**).
- Plan/tier claims are cached with a short TTL (60s) server-side and refreshed upon MFS transaction submission and verification — the stream path never blocks on external network lookups.
- The fake `recruiter-auth.ts` persona is replaced by the real session; its preferences
  schema is migrated into `users.preferences`.

**Signup funnel (the demo stays):**
1. Anonymous visitor → 1 free fresh audit per profile (cookie + cache aware, §10).
2. Completion → banner: "3 free analyses monthly — create your free workspace" (no card).
3. Wall moments (demo exhausted / quota exhausted) → signup modal, never a dead end:
   the user always keeps read access to everything already generated.

---

## 4. Data model & isolation

Postgres via Supabase (RLS on every table). **jsonb-first**: the existing TypeScript
interfaces map 1:1 into `data jsonb` columns, so nothing is lost and normalization can wait.

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `email`, `github_handle?`, `name`, `preferences jsonb` | one per human |
| `workspaces` | `id`, `owner_user_id`, `type: individual \| team`, `name` | candidate & recruiter workspaces |
| `memberships` | `workspace_id`, `user_id`, `role` | team seats |
| `target_roles` | `id`, `user_id`, `data jsonb`, `updated_at` | mirrors `TargetRole` interface |
| `defense_cards` | `id`, `user_id`, `data jsonb` | survives role deletion (as today) |
| `requisitions` / `job_projects` | `id`, `workspace_id`, `data jsonb` | recruiter-side |
| `proofs` | `username`, `role_id`, `owner_user_id`, `profile jsonb`, `version`, `published_at` | **public reads by design**; file store already matches this shape |
| `usage_events` | `id`, `user_id?`, `kind`, `target`, `cache_hit`, `cost_est_cents`, `created_at` | the meter (§5) |
| `subscriptions` | `user_id`/`workspace_id`, `plan`, `status`, `current_period_end` | MFS & platform accounts ledger |

**Red lines — enforced at the API layer, not the UI:**
1. **User↔user isolation:** my audits, roles, and practice data are never readable by another user.
2. **Candidate↔recruiter isolation:** a recruiter workspace can never read CareerOS campaign
   data (target roles, audits, defense cards). Contexts share an account, never data.
3. **Proofs are the exception:** only explicitly published snapshots are public — publishing
   is a deliberate act, and unpublishing must actually remove public access.

---

## 5. Metering & the usage ledger

`usage_events` is the single meter. Written on **every** fresh audit (anonymous demo runs
too, keyed by cookie id), never on cache hits.

**Enforcement (atomic):** inside `GET /generate`, before agent work starts:

```
BEGIN;
  count = SELECT count(*) FROM usage_events
          WHERE user_id = $1 AND kind = 'audit'
            AND created_at > now() - interval '30 days'
          FOR UPDATE;                       -- or a per-user counter row lock
  if count >= limit(tier, 'audit.run') → rollback, emit `quota_exhausted` event
  INSERT INTO usage_events (...);
COMMIT;
→ then start agent work
```

The race to avoid: two concurrent SSE connections both passing a "read count" check.
The reserve must be transactional (or a locked counter row).

**Cost capture:** record best-effort `cost_est_cents` per run (provider + token usage). This
gives a real margin view per audit and makes pricing defensible — "more rigorous" later
means tightening the registry, not archaeology.

**Read-only after the wall:** exceeding quota never hides existing data. All generated
audits, ledgers, and published pages remain accessible; only *new* runs are blocked.

---

## 6. Capability & tier registry (the single source of limits)

```ts
// shape — one file, imported by backend enforcement AND frontend meters
export const TIERS = {
  anonymous: { 'audit.run': { limit: 1, per: 'profile', scope: 'cookie' }, ... },
  free:      { 'audit.run': { limit: 3, per: '30d' },
               'target_role.create': { limit: 1 },
               'proof.publish': { limit: 1, branded: true },
               'practice.full': false, ... },
  pro:       { 'audit.run': 'unlimited', 'target_role.create': 'unlimited',
               'proof.publish': 'unlimited', 'practice.full': true,
               'screen.simulated': true, priority: true, ... },
  team:      { 'screen.batch': 'unlimited', 'export.ats': true, seats: true, ... },
} as const;

can(user, capability, ctx) → { allowed, remaining, reason }
```

The same `can()` result powers: backend 402/`quota_exhausted` responses, frontend quota
meters, and feature-lock chips. **No dark patterns:** paywalls limit *quantity* and *power
features*; they never hide the user's own existing self-assessment (ideation §2.6).

**Default tier matrix (v1):**

| Capability | Anonymous | Free | Pro ($14/mo) | Team ($29/seat/mo) |
|---|---|---|---|---|
| `audit.run` (fresh) | 1 per profile (cookie-bound) | 3 / rolling 30d | Unlimited + priority | — |
| Cache reads / re-view | unlimited | unlimited | unlimited | — |
| `target_role.create` | — | 1 | Unlimited | — |
| `proof.publish` | — | 1 active, DevScope branding | Unlimited, unbranded | — |
| `practice.full` (spaced repetition) | — | view-only bank | Included | — |
| `screen.simulated` | — | — | Included (when built) | — |
| `screen.batch` / `export.ats` / shared pipelines | — | — | — | Included |
| Data export / delete (GDPR) | — | Included | Included | Included |

---

## 7. Gating UX surfaces

| Surface | Free shows | Wall behavior |
|---|---|---|
| `/developer` header | "2 of 3 analyses left this month" meter | Meter turns signal-color at 1 remaining |
| After demo audit | Banner: create free workspace (no card) | CTA → signup with the just-audited handle pre-filled |
| Pre-flight button (quota exhausted) | Disabled with reason tooltip | Modal: Free (wait for reset / upgrade to Pro) |
| Defense Hub practice | Bank visible, grading locked | "Practice is Pro" chip; never hides past reps |
| Proof publish (2nd page) | Existing pages list stays | Modal: Pro for unlimited pages |
| Recruiter portal | Local demo mode, clearly labeled *local-only, no cloud sync* | Team plan CTA for batch/cloud features |

---

## 8. Billing (Bangladesh MFS: bKash & Nagad)

- **Checkout & Instant Activation:** users submit their bKash or Nagad Transaction ID (TrxID) via the checkout modal.
- **24-Hour Provisional Access:** instant Pro access is granted immediately upon TrxID submission so candidates never experience friction or waiting.
- **Asynchronous Admin Verification:** Super Admin reviews submissions inside the Admin Console (`/admin/billing`). Approving confirms permanent 30/365-day access.
- **Dynamic Configuration:** Super Admin dynamically updates bKash/Nagad phone numbers, account types (Personal/Merchant), and user notices live without redeployments.
- **Hot path:** plan read from a 60s-TTL server cache; zero blocking external API calls inside SSE.
- **Local BDT Price points:** ৳399/mo or ৳3,490/yr for Developer Pro; ৳1,999/mo or ৳18,990/yr for Recruiter Team.

---

## 9. Migration from localStorage (nothing built is lost)

On **first login**, client POSTs existing payloads to `/api/workspace/import`; server
upserts; client sets `devscope_migrated_v1`; localStorage remains as an offline read cache.
Import must be **idempotent** (re-login never duplicates).

Exact keys to migrate:

| Key | Store | Destination |
|---|---|---|
| `devscope_developer_profile_v1` | workspace-profiles | `users.preferences` + handle claim |
| `devscope_recruiter_profile_v1` | workspace-profiles | recruiter workspace row |
| `devscope_recruiter_account_v1` | recruiter-auth (fake persona) | discarded; preferences kept |
| `devscope_target_roles_v1` + `devscope_active_target_role_v1` | target-roles | `target_roles` (per user) |
| `devscope_defense_cards_v1` | target-roles | `defense_cards` (per user) |
| `devscope_saved_requisitions_v1` + `devscope_active_role_id_v1` | requisitions | `requisitions` (workspace) |
| `devscope_job_projects_v3` + `devscope_active_job_id_v3` | job-projects | `job_projects` (workspace) |
| `devscope_active_workspace_v1`, `devscope_theme_v2` | UI prefs | stay local |

Published proofs migrate from the file store (`backend/cache/proofs/`) into the `proofs`
table, claiming `owner_user_id` by matching GitHub handle on first login.

---

## 10. Security & abuse

- **Anonymous demo:** cookie `devscope_demo_runs_v1` = handles already demo-audited (fresh
  runs only; cache hits free). **IP backstop:** in-memory limiter, ~10 fresh runs/hour/IP.
  Honest limitation: shared NATs collide — acceptable for v1, revisit with accounts.
- **Rate limits:** per-user and per-IP on `GET /generate` (e.g., 1 concurrent + 5/min burst).
- **Signup abuse:** disposable-email screening on magic link; GitHub OAuth rate trust;
  free-tier handles must match the audited profile's owner claim (handle ownership verified
  via OAuth where available).
- **Secrets:** provider keys only in backend env; frontend never sees LLM credentials.
- **Data rights:** export + delete endpoints per user (GDPR baseline) ship with M24D.

---

## 11. Decisions log

**Decided (this doc):**
1. Demo stays but is bounded: 1 fresh audit per profile, cookie + cache aware.
2. Three-layer build order: identity → metering → gating/billing.
3. Atomic check-and-reserve at the stream chokepoint; no signed token in v1.
4. GitHub OAuth for developers; magic link for recruiters; one account, two contexts.
5. Limits live in one tier registry; `can()` powers backend + UI.
6. Cache reads are always free; quota blocks *new runs* only, never hides data.
7. Red lines: user↔user and candidate↔recruiter isolation enforced at the API layer.
8. jsonb-first schema mirroring existing interfaces; migrate on first login, idempotently.
9. **(2026-10-05) Auth stack: managed — Supabase.** Project to be created by the owner;
   M24B ships code-complete behind env config with an offline dev-auth mode.
10. **(2026-10-05) Free tier: 3 audits / rolling 30 days.**
11. **(2026-10-05) Anonymous demo stays** (1 fresh audit per profile, cookie + IP gated) after
    accounts ship.
12. **(2026-10-05) Free proof-page branding: footer-only** "Built with DevScope" line — no
    watermark; keeps the artifact premium while preserving attribution.
13. **(2026-10-06) Pro price: $14/mo, with $120/yr as the annual anchor** (two months free).
    Chosen over $19 because the Free tier already ships 3 audits/month — the paid value is
    the lift, not the access, so the wall has to stay cheap to cross.
14. **(2026-10-06) Team: $29/seat/mo.** Roughly 2x Pro per seat, which is the usual shape for
    shared pipelines plus batch screening. Pilot discounts are a commercial lever, not a
    list-price change.

**Open (needs sign-off before the relevant milestone):**
1. ~~Pro price point~~ — **signed off 2026-10-06, $14/mo** (decision 13).
2. ~~Team seat price~~ — **signed off 2026-10-06, $29/seat/mo** (decision 14). Pilot discount
   policy still to be set from the 5-recruiter pilot.

---

## 12. Build order

Detailed sub-milestones, scopes, and acceptance criteria live in
**`MONETIZATION_BUILD_TRACKER.md`**:

```
M24A  Anonymous demo gating          (no accounts needed — closes the cost hole)
M24B  Accounts & auth                (GitHub OAuth + magic link, contexts)
M24C  Usage ledger + chokepoint      (the meter + atomic enforcement)
M24D  Workspace storage + import     (server-side stores, localStorage migration)
M25A  Tier registry + gating UX      (limits as data, meters, upsell surfaces)
M25B  Bangladesh MFS billing         (bKash & Nagad, 24h provisional access, verification ledger)
M25C  Team seats                     (defer detail; pilot-informed)
```

Each step is independently shippable. Cost protection lands first; billing lands last,
when there is something real to bill for.
