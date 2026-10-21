# GitGrill — Developer Career OS: Ideation & Build Plan (2026–2027)

> Companion document to `DEVSCOPE_SPEC.md` (system spec), `product_roadmap_and_plan.md` (2026 roadmap),
> and `BUILD_TRACKER.md` (build log). This document is the **product thesis + build plan for the
> Developer Workspace** — the counterpart to RecruiterOS — and the **monetization architecture**
> that funds it.
>
> Version: 1.0 · September 2026 · Status: PROPOSED (not yet committed to build order)

---

## 0. The Thesis in One Paragraph

RecruiterOS optimizes the **hiring side**: screen many candidates, rank, compare, advance.
But the person who actually spends months in the arena is the **developer** — and today they get
a one-shot landing-page demo. A real job search is a 3–9 month campaign: dozens of applications,
many tailoring iterations, phone screens, rejections, feedback, skill gaps discovered *mid-campaign*.
DevScope already computes exactly the signals a developer needs to run that campaign intelligently
(fit scores, verified evidence, gap probes, interview defense) — it just never gave the candidate
a workspace to use them **cumulatively**. The Developer Career OS is that workspace: the same
intelligence engine, pointed at the candidate, run over weeks, learning from every application
and interview.

**Positioning line:**
> *"RecruiterOS screens candidates. CareerOS gets them hired."*

---

## 1. The User: Job-Seeking Developer, End of 2026

Understand the emotional arc before the feature list. A real search looks like:

1. **Spray phase (weeks 1–4):** applies to 30–80 roles. Uses the same resume everywhere. Hears ~5% back. Demoralized.
2. **Calibration phase (weeks 4–8):** learns which roles they're actually competitive for. Starts tailoring. Interview gap becomes visible ("I keep getting asked about system design and keep failing").
3. **Iterate phase (months 2–5):** interviews, gets rejections, extracts feedback, patches skill gaps, rebuilds public evidence (portfolio, README, live demos), re-applies smarter.
4. **Close phase:** negotiates with competing options using an objective read of their own market value.

Today's tool serves phase 0 with a single pre-flight audit. The insight: **every recruiter screening the developer runs against them through DevScope already models what the market will ask.** If the developer could see the same lens, the search becomes a solvable system instead of a slot machine.

### What the 2026–27 environment changes the calculus

| Environment shift | Implication for the product |
|---|---|
| **AI-generated applications are the default.** Recruiters are flooded; keyword filters are dead. | The scarce asset is **verified evidence**, not polished prose. DevScope's Claim vs. Evidence Matrix is the moat — it must become the developer's *proof-of-work ledger*. |
| **AI-assisted coding is table stakes; AI-agent fluency is the differentiator.** Employers screen for it explicitly. | New audit dimensions needed: agentic tooling usage (Copilot/Claude/Cursor commit patterns), AI-disclosure quality, prompt/engineering artifacts in repos. |
| **First-round screens are increasingly conducted by AI agents** (voice + coding). | Developers need **practice against the same class of interviewer**: gap-driven question banks, simulated screens, adversarial follow-ups. |
| **Verified-identity signals rise** (GitHub attestations, provenance). | Portfolio "proof pages" with verifiable audit links become shareable currency. |
| **Hiring remains conservative in downturn; timelines stretch.** | The tool must be valuable across a *long* campaign — weekly usefulness, not one-shot. |

---

## 2. Developer Career OS — Product Concept

### 2.1 The Home: `CareerOS Command Center` (`/developer`)

A mission-control page mirroring RecruiterOS's structure but inverted in purpose. Sections:

1. **Proof Strength Card (the headline metric).**
   One number: *how competitive is your current public evidence?* Composed from:
   - Verified skills depth (from audit)
   - Live production artifacts (count + quality)
   - Public narrative quality (README/portfolio/blog presence)
   - Requisition-fit average across target roles
   Rendered with an explicit **"what's holding this number down"** driver list (see 2.2).

2. **Target Roles Board.**
   The developer's saved target roles (like RecruiterOS job projects, but roles they're chasing).
   Each card: role title, source (pasted JD / saved / imported from URL), fit score of the latest
   audit, gap count, application status (`Researching → Applied → Screening → Interviewing → Offer / Rejected`),
   and next action. This is the campaign kanban.

3. **Application Pipeline.**
   Per-role status tracking with a *history ledger*: every audit run against that JD is kept,
   so the developer can see "fit was 62% in March, 81% after I shipped the event-sourcing demo."
   That delta is the product's core feedback loop: **evidence in → score out → evidence → score**.

4. **Interview Defense Hub.**
   Every audit already produces gap probes and phone-screen questions. CareerOS accumulates them
   into a personal question bank per target role, with:
   - "What to listen for" self-grading rubric
   - A **Practice Mode** (see 2.4)
   - Confidence marking (never-seen / shaky / solid) that feeds spaced repetition

5. **Skill Gap Radar.**
   Aggregated across all recent audits: which requirements most frequently land as
   `gap_probe` or `partial`? Ranked, with a suggested evidence-building plan per gap
   ("Build a small service demonstrating X; deploy it; add it as your second live URL").

6. **Signal Maintenance Strip.**
   Small, high-value nudges: stale portfolio URL detected (audit returns 5xx), README missing on
   flagship repo, no live demo for the role you applied to yesterday, GitHub profile README
   hasn't changed in 8 months while targeting Staff roles.

### 2.2 The Core Loop (what makes it a companion, not a report)

```
        ┌─────────────────────────────────────────────────────────┐
        │  1. TARGET     Save the JD you're about to apply for    │
        ▼                                                         │
   [ Run Pre-Flight ]  ← same agent, same tools, dev-facing lens  │
        │                                                         │
        ▼                                                         │
   2. READ: Fit scorecard + gap radar + defense questions         │
        │                                                         │
        ▼                                                         │
   3. ACT: evidence-building tasks generated from gaps            │
      (ship demo / rewrite README / write blog post / OSS PR)     │
        │                                                         │
        ▼                                                         │
   4. RE-verify: re-run audit → watch fit move 62% → 81%          │
        │                                                         │
        ▼                                                         │
   5. APPLY: export the *evidence pack* with the application      │
      (verified dossier link + tailored fit card)                 │
        │                                                         │
        └────────────────────────────── log outcome ─────────────┘
```

The loop only works if outcomes feed back (applied → screen → rejected → why?). Even coarse
self-reported outcomes ("got a screen", "ghosted", "rejected after tech") let DevScope learn
which signals correlate with real-world advance for *this user* — turning the product from
an auditor into a coach.

### 2.3 The Evidence Pack (the shareable artifact)

When a developer applies, they attach/link a **Proof Page**:
`/proof/:username/:roleId` — a public, recruiter-legible page showing:
- Verified evidence matrix (with links to commits/repos/live app)
- Live app audit card (uptime, latency, stack)
- Fit scorecard *against the exact role they applied to*
- Verifiable audit timestamp + DevScope attestation badge

This flips the product: recruiters receiving it get value (structured, pre-audited candidate),
which creates a viral loop — every application spreads DevScope into hiring teams, converting
recruiters (the paying side) and candidates (the free-to-usage side). The Proof Page is also
the natural embed of the already-planned "Verified Talent Badge."

### 2.4 Interview Defense (AI-era must-have)

Two modes, both grounded in the developer's own audit data — never generic question banks:

- **Rapid Practice:** flashcard-style on accumulated gap probes; self-grade; spaced repetition
  schedules resurfacing based on confidence + interview proximity.
- **Simulated Screen (Phase 2):** an LLM agent role-plays a 15-minute technical screen using the
  target role's requirements and the developer's *unverified claims* as its question set — the
  same lenses RecruiterOS gives hiring teams. Optionally voice (Web Speech API) in 2027.
  Output: a graded debrief with exactly what a strong answer would contain, tied to the
  developer's own projects ("When asked about concurrency, cite your queue-backpressure work
  in `@you/service-x`").

This is the single highest-retention feature for a months-long search: it converts
"read my report" into "train against my specific weaknesses."

### 2.5 Feature Inventory (MVP → later)

| # | Feature | Value | Effort | Phase |
|---|---|---|---|---|
| D1 | `/developer` Command Center shell (nav, workspace, profile) | home base | M | 5a |
| D2 | Target Roles store (`lib/target-roles.ts` — mirror of requisitions) | campaign backbone | S | 5a |
| D3 | Pre-flight audit wired to target roles + application-status fields | core loop start | S | 5a |
| D4 | Skill Gap Radar (aggregate over audits) | self-awareness | M | 5a |
| D5 | Interview Defense Hub v1 (question bank + self-grade + spaced repetition) | retention engine | M | 5b |
| D6 | Proof Page `/proof/:username/:roleId` (public recruiter-legible) | growth engine | M | 5b |
| D7 | Application status tracker + audit-history ledger per role | iteration visibility | M | 5b |
| D8 | Evidence-building task generator (gaps → concrete tasks) | "companion" feel | M | 5b |
| D9 | Signal maintenance nudges (stale URLs, missing READMEs) | weekly value | S | 5b |
| D10 | Simulated Screen agent (text; voice later) | AI-era differentiator | L | 6 |
| D11 | AI-tooling fluency audit (commit patterns, agentic artifacts) | 2027 relevance | M | 6 |
| D12 | Proof-strength score history + trend chart | motivation | S | 6 |
| D13 | Portfolio "what-if" simulator (score projection: "if you ship X demo, +7 fit") | planning | M | 6 |
| D14 | Private-repo aggregate proof via GitHub OAuth (already Phase 4 item) | working-dev accuracy | L | 6 |
| D15 | Offer/negotiation brief (market read from campaign data) | endgame | S | 6+ |

### 2.6 Privacy & Ethics Red Lines (non-negotiable)

- The developer's audits are **theirs**. Recruiter side never sees a candidate's CareerOS data.
- A candidate viewing their own dossier is the default owner; viewing *others* for comparison
  is allowed (public data) but excluded from any coaching narrative.
- No dark patterns on the freemium wall (see §3) — paywalls limit *quantity*, never hide
  basic self-assessment.
- All coaching claims are evidence-grounded; the agent never invents "market data" it can't
  source from the user's own campaign or public artifacts.

---

## 3. Monetization & Workspace Architecture

> **Status update (Oct 2026):** this section was the draft thesis. The finalized,
> build-ready architecture now lives in `MONETIZATION_ARCHITECTURE.md` and supersedes §3
> where they differ (notably: identity providers, the atomic-reserve design, the tier
> registry, and the data model). §3.4 landing repositioning still applies as written.
> Build progress: `MONETIZATION_BUILD_TRACKER.md`.

### 3.1 Current state vs. target

Today: no accounts, no limits, recruiter identity is a local-storage persona (`Sarah Chen, Pro Seat`
is decorative). Target: **developer-friendly freemium** with a real account boundary, where the
free tier is genuinely useful (growth) and paid tiers fund the LLM cost (the real marginal expense:
~$0.01–0.05 per audit at current flash-class pricing, plus GitHub API quota).

### 3.2 Tier Design

**Free — "Proof Tier" (candidate-first)**
- **3 full audits / month** (rolling 30 days), then read-only access to everything already generated
- 1 target role
- Gap radar + interview question bank (view)
- Proof Page: **1 active** with DevScope branding
- No credit card, no trial clock — the tier is the funnel

**Pro — `CareerOS Pro` (~$12–19/mo, the individual candidate)**
- Unlimited audits + re-verify
- Unlimited target roles + full campaign pipeline
- Simulated Screens (when built), full Practice Mode
- Unlimited Proof Pages, no branding, custom domain
- Portfolio what-if simulator, signal nudges
- Priority queue on the agent (matters when free tier queues)

**Teams — `RecruiterOS Team` (per-seat, the revenue engine)**
- Everything in recruiter portal today + Milestones 16–18 (batch screening, application portal,
  cloud sync across the hiring team)
- Shared pipelines, comment threads, committee briefs
- ATS export (CSV / API) — this is what makes a team pay
- SLA / higher rate limits / SSO later

**Positioning note:** recruiters pay seats because it replaces spend; candidates pay subs because
it *shortens a search worth $20k+ of salary time*. Both are honest value stories. The free
candidate tier deliberately overlaps with the recruiter acquisition loop (Proof Pages circulate).

### 3.3 Enforcement Surfaces (what must actually exist technically)

1. **Identity.** Magic-link email auth (no passwords). One identity can hold both a candidate
   and recruiter context; roles are switchable (mirror of `workspace-profiles.ts` but
   server-persisted). GitHub OAuth for private-proof (D14) is separate and optional.
2. **Quota ledger.** A `usage_events` table (audit_id, user_id, cost, created_at). The
   `/api/agent/stream` route becomes the single enforcement point: check quota → issue a
   short-lived signed analysis token → allow SSE. Anonymous users keep 1 demo audit per
   profile (the landing-page freebie, cookie-bound, cache-eligible).
3. **Account & workspace separation.** Postgres (or hosted equivalent — Supabase fits the
   existing stack signals) with: `users`, `workspaces` (`type: individual | team`),
   `memberships`, `target_roles`, `applications`, `audits`, `usage_events`, `subscriptions`
   (MFS). Local-storage schemas migrate into user rows on first login — nothing the early
   users built is lost.
4. **Payments.** Bangladesh MFS (bKash & Nagad) with 24-hr instant provisional access; plan state cached in the session token so the
   hot path (SSE check) never blocks on remote payment lookups.
5. **Cache policy under accounts.** Today's public 24h profile cache becomes user-scoped
   re-verify; the recruiter's "fresh run" button consumes *their* quota — this closes the
   current loophole where unlimited anonymous regeneration = unlimited cost.

### 3.4 Landing Page Repositioning

The hero stays a **public demo** (one free no-signup audit — top of funnel, unchanged),
but every subsequent surface communicates the boundary:
- After demo audit: banner "3 free analyses monthly — create your free workspace" (no card)
- Recruiter portal entry switches from the fictional `Sarah Chen` persona to real auth;
  a lightweight "Continue in local mode" is kept for evaluation but clearly marked
  *local-only, no cloud sync, batch features disabled*.

---

## 4. What the AI-Heavy 2027 Environment Demands (bets section)

These are the bets that keep DevScope relevant as the default hiring flow mutates:

1. **Verification becomes the product.** When everyone's resume is AI-perfect and everyone's
   take-homes are agent-written, the only durable value is *evidence*. Lean everything on the
   Claim vs. Evidence engine; add provenance (commit links, attestations) as first-class data.
2. **Screening agents will talk to career agents.** Mid-2027 plausibly: a candidate's agent
   negotiates with a company's screening agent. DevScope's position: the **structured evidence
   ledger** both sides can trust. Build the data model so a Proof Page is machine-readable
   (JSON-LD / verifiable presentation), not just HTML.
3. **Interview practice must be adversarial.** Static question banks die; agents that probe
   your *specific unverified claims* survive (D10). This is also the feature that most
   distinguishes DevScope from course platforms — it uses *your* artifacts.
4. **AI-fluency is a graded skill.** Recruiters will ask "how does this person work *with*
   agents?" — commit metadata patterns, agentic tooling artifacts, disclosure hygiene (D11).
5. **Trust & privacy become marketing.** Candidates will be increasingly sensitive about
   who can run audits on them. Ship a "profile visibility" control and a public stance:
   *audits of public data only, opt-out registry for individuals* — inexpensive now, brand-defining later.

---

## 5. Sequencing (proposal — final order to be decided in trackers)

**Phase 5a — CareerOS Foundation (build next)**
D1 `/developer` shell + theme-consistent UI using the new token system → D2 target-roles store
→ D3 wire pre-flight to roles → D4 gap radar. Exit: a developer can run a real campaign loop
manually.

**Phase 5b — Companion Layer**
D5 defense hub → D7 application tracker → D8 task generator → D6 Proof Page → D9 nudges.
Exit: weekly-return product; the "companion" promise is real.

**Phase 6a — Accounts & Monetization (can start in parallel on backend)**
Magic-link auth, quota ledger, Bangladesh MFS (bKash & Nagad), tier enforcement, data migration from localStorage.
Exit: free tier + Pro live; landing page boundary messaging shipped.

**Phase 6b — AI-era Bets**
D10 Simulated Screen → D11 AI-fluency audit → D14 GitHub OAuth private proof → D13 what-if
simulator → D15 negotiation brief. Exit: 2027-differentiated.

**Deliberately deferred:** team features beyond Milestones 16–18, marketplace ideas,
mobile app, agent-to-agent protocol standardization (watch, don't build, until 2027 signals).

---

## 6. Success Metrics (per tier)

| Tier | North-star | Guardrails |
|---|---|---|
| Free | % of signups completing 2+ audits within 14 days (activation) | p95 audit latency; abuse rate |
| Pro | Retention W8 → W20 during active searches | Refund/complaint rate; score-trust (survey) |
| Proof Pages | % of applications shared as Proof Pages (viral k-factor) | Recruiters clicking through to DevScope |
| RecruiterOS | Seats converting from Proof Page traffic | Churn < 5%/mo; batch-screening usage |
| Whole system | "Fit delta": median fit-score improvement from first audit → campaign end | (the core value proof) |

---

## 7. Open Questions (for the tracker discussion)

1. Free-tier audit count: 3/month vs 1/week? (Monthly bucket feels fairer; weekly drives habit.)
2. Proof Page branding on Free — watermark vs. footer-only?
3. Anonymous landing-page demo: keep at 1 free audit per profile (cache-bound), or require
   signup from day one of Phase 6a?
4. Simulated Screen: text-first (ship in weeks) vs voice-first (differentiated but heavier)?
5. Pricing point for Pro: $12/mo annual vs $19/mo monthly anchor?
6. Should RecruiterOS local-mode (current localStorage experience) survive after accounts ship,
   and with which features disabled?
7. AI-fluency audit (D11): is measuring "how someone uses AI tools" acceptable scoring, or
   does it read as surveillance? Needs framing care.
