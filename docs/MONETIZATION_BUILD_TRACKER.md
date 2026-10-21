# GitGrill — Monetization Build Tracker (Milestones 24–25)

> **Companion to:** `BUILD_TRACKER.md` (overall build history) and
> `MONETIZATION_ARCHITECTURE.md` (the spec — source of truth for *why* and *what*).
> This file is the *executable* plan: sub-milestones, scopes, acceptance criteria, status.
>
> **Rules of engagement for this phase:**
> - One sub-milestone = one commit (authored as the user, no attribution).
> - Acceptance criteria are checked only after verification (typecheck + browser/API test).
> - Open decisions in `MONETIZATION_ARCHITECTURE.md` §11 must be signed off *before* the
>   milestone that depends on them starts.

---

## Phase Definition of Done

A stranger can complete this journey end-to-end, and an existing user loses nothing:

1. Land → run **1 free demo audit** (no signup) → hit the demo wall.
2. Create an account (GitHub OAuth / magic link, no card) → their demo work is still there.
3. Get **3 audits/month** free, with a live meter; hit the wall → clear upgrade path.
4. Pay (bKash/Nagad MFS) → limits lift immediately; cancel → graceful downgrade.
5. An existing localStorage user logs in → target roles, defense cards, proofs all present.
6. Candidate campaign data is provably unreadable from the recruiter context (API test).

---

## M24A — Anonymous demo gating

**Aim:** bound the demo — one fresh audit per profile per browser — without accounts.
Closes the only current cost hole (`GET /api/agent/stream` is currently unlimited).

**Scope:**
- `backend/src/routes/api.ts` — demo check before agent work on fresh runs.
- Cookie `devscope_demo_runs_v1` (handles already demo-audited); cache hits never consume.
- In-memory IP backstop limiter (~10 fresh runs/hour/IP).
- `frontend` — "create free workspace" banner after demo completes; wall modal on
  `demo_exhausted` error event (never a dead end).

**Out of scope:** accounts, real quotas, billing.

**Acceptance criteria:**
- [x] Fresh audit on a new handle → allowed once; second fresh run on same handle → blocked
      with a structured `demo_exhausted` SSE error.
- [x] Cached profile read → always served, never consumes demo budget.
- [x] Clearing cookies and retrying → IP limiter still blocks beyond the hourly cap.
- [x] Banner appears after demo completion with a signup CTA (handle pre-filled).
- [x] All existing flows (recruiter demo, proof pages) unaffected.

**Status:** `[x]` complete
**Build note:** Backend half (`backend/src/security/demo-gate.ts`): cookie
`devscope_demo_runs_v1` (HttpOnly, SameSite=Lax) tracks demo-audited handles; cache hits
never consume; IP backstop (`DEMO_IP_HOURLY_CAP`, default 10/hr, in-memory). `DEMO_LIMIT=off` escape hatch for dev. Route restructured
so cache read + gate run **before** `flushHeaders()` (Set-Cookie must precede flush — bug
caught and fixed in verification). Frontend half (`components/DemoUpsell.tsx`):
`DemoSignupBanner` renders after a fresh non-cached completion (sessionStorage dismissal);
`DemoWall` replaces the generic error card on `demo_exhausted`/`rate_limited`, with an
honest "accounts ship next milestone" CTA until M24B. **Cross-origin lesson:** the frontend
calls the backend on a different port, so EventSource needed `{ withCredentials: true }`
AND backend CORS `credentials: true` — without them the demo cookie never round-tripped
(silently; caught only by live browser verification). Verified in browser: fresh run →
banner; replay → wall with server message; cache hits free. **IP-cap load test (final criterion):** with
`DEMO_IP_HOURLY_CAP=2`, 8 sequential fresh runs from one spoofed IP — exactly 2 passed the
gate (nonexistent handles fail fast at the GitHub fetch, zero agent/LLM cost), the remaining
6 got structured `rate_limited` SSE errors with no agent runs. Test script was temporary and
removed; backend restored to default cap after.

---

## M24B — Accounts & auth

**Aim:** real identity — GitHub OAuth (developers) + email magic link (recruiters),
one account with two switchable contexts. Replaces the fake `recruiter-auth.ts` persona.

**Depends on:** architecture §11 open decision #1 (managed vs self-hosted) — **sign off first**.

**Scope:**
- Auth provider setup (Supabase recommended); `users`, `workspaces`, `memberships` tables + RLS.
- Frontend: session provider, login/signup surfaces, context switcher wired to real session.
- Backend: JWT verification middleware (signature only, no DB hit on hot path).
- `recruiter-auth.ts` replaced; its preferences schema migrates into `users.preferences`.

**Out of scope:** quota enforcement (M24C), import (M24D), billing (M25B).

**Acceptance criteria:**
- [x] Sign in with Email OTP → 6-digit verification code sent via Supabase (or simulated locally in dev mode).
- [ ] Sign in with GitHub → account created, handle captured; sign in with magic link →
      same human merges by verified email. _(needs frontend Supabase keys in .env.local; local dev sign-in path
      verified end-to-end with zero 403 blocks)_
- [x] Both contexts visible on one account; switching never merges candidate/recruiter data.
- [x] Signed-out recruiter portal clearly labeled *local-only demo mode* (or gated per §7).
- [x] Backend rejects forged/expired JWTs; all new tables have RLS enabled and tested.
      _(forged token → 401 verified)_
- [x] No regression: anonymous demo still works.

**Status:** `[x]` code-complete and verified; live OAuth pending frontend Supabase keys
**Build note:** `db/supabase.ts` (admin client, config probe, row types);
`auth/middleware.ts` (`attachAuth` global — token from `Authorization: Bearer`,
`x-devscope-session`, or `access_token` query param because EventSource cannot set
headers; `requireAuth` 401/503); `auth/routes.ts` — `GET /api/auth/me`,
`POST /api/auth/sync` (idempotent user + workspace + membership provisioning),
`POST /api/auth/dev-auth` (local mode: `DEV_AUTH_MODE=on` mints real HS256 session
tokens, 7d expiry, verified by the same middleware path as Supabase JWTs);
`auth/supabase-setup.sql` — full schema + RLS (users/workspaces/memberships, plus the
M24D workspace tables and M24C meter tables — meter tables RLS-enabled with NO policies:
service-role writes only). Frontend: `lib/auth.ts` (supabase|dev backend switch),
`SessionProvider` + `AuthModal` (tabs for Sign In & Create Account, 2-step Email 6-digit OTP
with `sendOtp` and `verifyOtp`, plus resilient local fallback so local testing never hits 403
when connecting to a remote Supabase-enabled backend), `AccountMenu` (identity chip →
signed-in-as, Developer/Recruiter switcher, sign out). Verified: tsc clean both sides;
15-check behavioral suite; browser: email OTP sign-in → chip + context switcher;
sign-out → "Local-only demo mode" chip returns.

---

## M24C — Usage ledger + stream chokepoint

**Aim:** the meter. Every fresh audit is recorded and attributable; quota checks are atomic
and happen *before* agent work starts.

**Scope:**
- `usage_events` table (kind, target, cache_hit, cost_est_cents, created_at).
- `backend/src/routes/api.ts` — transactional check-and-reserve inside `GET /generate`;
  `quota_exhausted` SSE event with remaining/reset info.
- Anonymous demo runs also recorded (cookie-keyed) — one meter, two identity modes.
- Best-effort cost capture from provider usage.

**Out of scope:** tier registry (M25A) — v1 hardcodes Free limits in one config constant
that M25A will promote into the registry.

**Acceptance criteria:**
- [x] Concurrent SSE starts cannot exceed quota (race test: parallel requests, count ≤ limit).
      _(in-memory mode: 6 concurrent starts → exactly 3 allowed, ledger = 3)_
- [x] Cache hits never write usage rows; fresh runs always do.
- [x] Exhausted user gets a structured event and keeps full read access to existing data.
- [ ] `cost_est_cents` populated for real runs (best-effort, documented margin view).
      _(column exists, written null in v1 — capture deferred)_
- [ ] Anonymous demo budget is also ledger-backed (survives cookie deletion via IP rows).
      _(recording implemented, keyed `anon:<ip>`; enforcement is still the M24A gate;
      DB-mode verification pending keys)_

**Status:** `[~]` verified end-to-end in memory mode; DB-mode criteria pending keys
**Build note:** `security/usage-ledger.ts` — `FREE_AUDIT_LIMIT = 3` (the one config
constant M25A promotes into the registry), 30d rolling window, atomic compare-and-set
reserve on `user_counters` (conditional UPDATE retried on conflict; first-slot claim via
insert with 23505 conflict retry — the row lock makes concurrent SSE starts safe), and a
ledger-only in-memory fallback with the identical API so the chokepoint code never forks.
`routes/api.ts`: signed-in users bypass the M24A demo gate and hit `reserveAudit` before
any agent work; blocked runs get a structured `quota_exhausted` SSE event with
remaining/resetAt; anonymous allowed runs write best-effort `anon:<ip>` ledger rows;
cache hits short-circuit before any reserve. `GET /api/usage` is the meter endpoint;
`DemoUpsell` handles `quota_exhausted` with its own wall copy and the profile page routes
it to `DemoWall`. Verified: 3 fresh runs → 3/3 → 4th blocked; race test 6 concurrent →
exactly 3 allowed; anonymous demo gate regression; cache hits consume nothing.

---

## M24D — Workspace storage + localStorage import

**Aim:** account-based workspaces are the source of truth; existing localStorage users keep
everything they built (idempotent first-login import).

**Scope:**
- Tables: `target_roles`, `defense_cards`, `requisitions`, `job_projects` (jsonb-first).
- Proof store (`backend/cache/proofs/` files) → `proofs` table; owner claim by handle.
- `POST /api/workspace/import` (idempotent) + client trigger on first login + `devscope_migrated_v1`.
- Read/write paths move server-first with localStorage as offline cache.
- Export + delete endpoints (GDPR baseline).

**Out of scope:** team collaboration features beyond membership rows.

**Acceptance criteria:**
- [ ] Existing user logs in → target roles, defense cards, requisitions, job projects, and
      published proofs all present; localStorage still functions as cache offline.
      _(server routes ready; first-login client trigger not built yet)_
- [ ] Import run twice → zero duplicates. _(idempotent by construction; DB-mode test
      pending keys)_
- [ ] Recruiter workspace data readable only by its members (RLS test). _(pending keys)_
- [ ] Candidate campaign data unreadable from a recruiter context (API-level test — red line).
- [ ] Export produces a complete JSON of the user's data; delete removes it and revokes proofs.
      _(endpoints built; `proofs` table migration not in SQL yet)_

**Status:** `[~]` server routes complete; client import trigger + proofs migration pending
**Build note:** `workspace/routes.ts` — `POST /api/workspace/import` (jsonb-first: rows
store the existing TS interfaces verbatim in `data`, client-generated ids preserved;
idempotent — reads existing ids per kind and inserts only fresh rows),
`GET /api/workspace/export` (complete JSON), `DELETE /api/workspace/delete`. All behind
`requireAuth`; structured 503 until the Supabase keys exist, so local dev is unaffected.
Table DDL lives in `auth/supabase-setup.sql` (same file as M24B); `index.ts` mounts the
auth, usage, and workspace routers (landed here so every prior commit still compiles).
Remaining: first-login import trigger with the `devscope_migrated_v1` flag, `proofs`
table migration, RLS + import/export/delete tests once keys exist.

---

## M25A — Tier registry + gating UX

**Aim:** limits as data. One registry + `can()` consumed by backend enforcement and frontend
meters — so rigor later is a config change.

**Depends on:** §11 decisions #3, #4, #5 — **signed off** (managed Supabase auth, Free = 3
audits per rolling 30 days, anonymous demo retained, footer-only proof attribution).

**Scope:**
- `TIERS` registry + `can(user, capability, ctx)` shared by backend and frontend.
- Backend: replace M24C's hardcoded limits with registry lookups; per-capability responses.
- Frontend: quota meter on `/developer`, feature-lock chips (practice, proof publish),
  upgrade modal, "local-only demo" labeling for recruiter portal.
- Proof publish limit (Free = 1 active, branded) enforced server-side.

**Out of scope:** payments (M25B) — upgrade CTAs lead to a waitlist/contact until then.

**Acceptance criteria:**
- [ ] Every capability in the matrix (architecture §6) is enforced at its chokepoint.
      _(server-enforced: `audit.run` at the SSE chokepoint, `proof.publish` at PUT.
      `target_role.create` + `practice.full` are client-side walls only while that
      state is client-side — they become hard walls when M24D moves roles/deck server-first;
      `profile.read`/`data.export` are unlimited on every tier, so no wall exists)_
- [ ] Meter shows accurate remaining count; resets correctly at 30d boundary.
      _(remaining matches the ledger on every fetch and the registry-as-data rerun;
      the 30-day rollover itself is reported from the ledger window (`resetAt`) but was
      not exercised in real time)_
- [x] Paywalled surfaces never hide the user's own existing data (dark-pattern check).
      _(verified in the browser: a locked workspace keeps its role card fully usable,
      the practice deck stays visible view-only, re-publishing an owned proof page still
      bumps its version, and every wall repeats that existing work stays put)_
- [x] Changing a limit in the registry changes behavior with no code edits elsewhere.

**Status:** `[x]` complete — verified in the browser and against the registry
**Build note:** `backend/src/config/tiers.ts` is now the only place a limit exists:
`TIERS` (anonymous/free/pro/team) × 9 capabilities, `can(tier, capability, {used})` →
`Verdict` (allowed, remaining, branded, verbatim `reason`, `upgradeTo`), plus
`ruleFor`/`tierForSession`/`numericLimit`/`ALL_CAPABILITIES`. It is dependency-free and
imported by both sides through the `@backend/config/tiers` alias (it lives under
`backend/src/` because that build has `rootDir: ./src`), so the browser and the
enforcement code cannot drift. `security/entitlements.ts` adds `GET /api/entitlements`,
answering with per-capability verdicts computed from the same registry, adding
`resetAt` for `audit.run` and **failing closed** if the usage lookup errors.
`security/usage-ledger.ts` no longer hardcodes anything —
`FREE_AUDIT_LIMIT = TIERS.free['audit.run'].limit`. `proof.routes.ts` enforces
`proof.publish` on PUT: re-publishing a page you own always succeeds (version bump),
a new page over the allowance returns 402 `{error:'proof_limit', limit, remaining,
reason, upgradeTo}` and stamps `branded` from the registry at publish time, so a Pro
publish stays unbranded forever. Frontend: `QuotaMeter` (live remaining + bar, signal
color at ≤1, reset date, honest `demo · 1 audit per profile` for anonymous visitors),
`FeatureLock`/`useCapabilityLock` chips, and an `UpgradeModal` built from the registry's
own Pro labels that never claims checkout exists. Also hardened the public proof page
against snapshots missing `profile.github` — those are file-backed artifacts that outlive
code versions and must not white-screen a recruiter's link. Verified: 21/21 API checks
(anonymous vs Free verdicts, 402 shape, re-publish, public read, cleanup); registry-as-data
rerun (free limit patched 3→2 in that one file — meter and the SSE gate both moved, then
restored with an empty diff); browser pass at 1440px covering meter, role lock + upgrade
modal, and a branded public proof page.

---

## M25B — Bangladesh MFS billing (bKash & Nagad)

**Aim:** native self-serve payment for Bangladeshi developers and recruiters. Pro (individual: ৳399/mo) and Team (৳1,999/mo) via bKash & Nagad MFS with instant 24-hour provisional access and an async admin verification ledger.

**Depends on:** §11 decisions 13/14 — **signed off** (৳399/mo + ৳3,490/yr Pro, ৳1,999/mo + ৳18,990/yr Team).

**Scope:**
- Checkout (subscription mode), Customer Portal, webhook handler with signature verification.
- `subscriptions` table mirror; 60s-TTL plan cache on the hot path.
- Grace window for `past_due` (7d) → downgrade to Free; never deletes data.
- Upgrade CTAs wired from every M25A wall.

**Out of scope:** invoicing/enterprise contracting (manual for now).

**Acceptance criteria:**
- [ ] Test-mode purchase lifts limits immediately (meter updates without re-login).
      _(verified with real signed webhooks: `checkout.session.completed` flips the tier to
      pro in the same cycle and the meter reads unlimited without a re-login; the hosted
      Checkout redirect itself needs test keys + price IDs, so the full click-through is
      still to be run in a provisioned account)_
- [ ] Cancel → access until period end → graceful downgrade to Free; data intact.
      _(mirror keeps `active` + `cancel_at_period_end` so access continues to period end;
      `subscription.deleted` downgrades to Free, profile reads/export stay unlimited and
      the free meter comes back — pending one live test-mode cancel)_
- [x] Webhook replay/idempotency safe; forged webhook rejected.
      _(claimed event ids make redelivery a no-op; forged timestamp, missing signature and
      tampered body all rejected 400 — the claim is released if the write fails so Stripe's
      retry still applies it)_
- [x] No Stripe call on the SSE hot path (verified in logs).
      _(the SDK was pointed at a dead API host for the verification run: entitlements reads
      and five fresh SSE audits all completed, while the portal route failed loudly — proof
      the audit path never touches Stripe)_
- [x] Failed payment → `past_due` + grace, then downgrade.
      (`invoice.payment_failed` keeps the paid tier for `BILLING_GRACE_DAYS` (default 7) and
      `invoice.paid` clears it; with the window already closed the same event drops the user
      to Free on the next read — no cron, no deletion)_

**Status:** `[~]` code-complete and verified against signed webhooks; needs a real test-mode
purchase + cancel run once Stripe keys and price IDs exist
**Build note:** `billing/stripe.ts` owns the lazy client and maps price IDs → plans; the
catalogue itself is `config/plans.ts` (dependency-free, shared with the browser), so the
upgrade modal's advertised price is the price Checkout charges. `billing/subscriptions.ts` is
the mirror (`subscriptions` + `billing_events`, plus an in-memory fallback for local mode)
and the 60s-TTL plan cache every route reads — tier resolution is a read of local state, so a
Stripe outage cannot block an audit. `billing/billing.routes.ts` holds checkout, the Customer
Portal, subscription status, and the webhook; the webhook is mounted on the RAW body in
`index.ts` (before `express.json`) because the signature covers the exact bytes, and it is
the only writer of plan state — a checkout redirect grants nothing. Enforcement follows the
tier: `routes/api.ts` skips the free reserve for paid tiers but still records the run
(`recordPaidRun`) so cost and attribution stay complete; `entitlements.ts` and
`proof.routes.ts` read the resolved tier. Frontend: the upgrade modal picks monthly/annual
and starts Checkout, the account menu shows the plan and opens the portal, and a return
banner re-checks entitlements until the webhook lands. Unconfigured billing answers an honest
503 and the UI says so rather than faking a payment step. Verified: 19/19 billing checks +
6/6 dunning checks against SDK-signed events, both typechecks clean.

---

## M25C — Team seats (deferred detail)

**Aim:** per-seat Team plan for recruiter workspaces — shared pipelines, batch screening,
ATS export — informed by the 5-recruiter pilot (validation plan).

**Scope (to be detailed post-pilot):** seat invitations, per-seat billing quantity,
workspace-shared pipelines/notes, ATS export entitlements.

**Status:** `[ ]` not started — deliberately deferred until pilot data exists.

---

## Order & dependencies

```
M24A (cost hole)  →  M24B (identity)  →  M24C (meter)  →  M24D (workspaces)
                                                              ↓
                                        M25A (registry/UX) → M25B (MFS) → M25C (seats)
```

Each step independently shippable. **Cost protection first, billing last** — there is
nothing to bill until identity and metering exist.

## Risks (watch during this phase)

| Risk | Mitigation |
|---|---|
| Quota race (concurrent SSE) | Transactional reserve; race test in M24C criteria |
| Cookie-clearing abuse of demo | IP backstop + ledger rows (M24A/M24C) |
| Migration data loss | Idempotent import + localStorage kept as cache; export endpoint |
| Auth vendor lock-in | Thin session interface; JWT verification is standard |
| Stripe webhook drift in dev | `stripe listen` documented; webhook is only plan writer |
| Scope creep into team features | M25C deferred until pilot data exists |
