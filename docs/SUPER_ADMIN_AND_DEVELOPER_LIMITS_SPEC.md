# GitGrill — Super Admin Platform, Dynamic MFS & Developer Limits Architecture Spec

> **Document Version:** v1.0 · October 2026  
> **Status:** Architecture Blueprint & Implementation Plan  
> **Core Objective:** Establish a unified **Super Admin & Platform Management Console**, eliminate all Rocket and Stripe references (pure bKash & Nagad MFS focus), make MFS account details dynamically editable from the Admin Portal, introduce dynamic tier & user capability limits (with primary focus on the Developer CareerOS ecosystem), allow user invitations with custom quotas, and grant Super Admins absolute, unconstrained platform access.

---

## 1. Core Principles & Strategic Alignment

1. **Pure Bangladesh MFS (Zero Rocket, Zero Stripe):**
   - Completely remove all legacy references, buttons, env vars, and types for **Stripe** and **Rocket**.
   - The platform exclusively uses **bKash** and **Nagad** for all transactions.
   - MFS numbers, merchant/personal types, and payment instructions must **not** be hardcoded in frontend components or backend constants. They are managed dynamically by the admin and served via an API endpoint (`GET /api/billing/mfs/config`).

2. **Developer CareerOS Standardization Priority:**
   - GitGrill's primary focus is the **Developer Career Command Center** (Resume Vault, Target JDs, Code Defense, Profile Audits, and Proof Pages).
   - Recruiter capability is de-emphasized for this phase and will be standardized later.
   - All metering, quota checks, and tier definitions are aligned around developer workflows.

3. **Super Admin Absolute Authority & Zero Limits:**
   - Super admins (`isAdmin(user) === true` via email whitelist or `app_metadata.role === 'admin'`) have **unlimited access** across every tool, agent, route, and feature.
   - Super admin runs consume no user quota, never hit demo/rate limits, bypass tier walls, and can run continuous Tier 1 & Tier 2 deep code audits freely.

4. **Dynamic Tier & Per-User Limit Overrides:**
   - Capability limits (Resumes uploaded, Target JDs tracked, Profile & Deep Code audits run, Resume tailoring runs, Proof pages published) can be updated platform-wide by admin without redeploying code.
   - Admins can grant **per-user overrides** (e.g. give a specific active user 50 audits or 20 resume uploads).
   - Admins can **invite users** with pre-assigned tiers or custom quotas.

---

## 2. Dynamic MFS Management Architecture

### 2.1 The Problem with Static MFS Details
Previously, bKash/Nagad numbers were static text in `BkashNagadModal.tsx` and `mfs-payment.service.ts`. If an admin's personal bKash/Nagad daily transaction limit is reached (e.g. ৳25,000 daily limit for personal accounts) or a number changes, code edits and full redeployments were required.

### 2.2 Dynamic Configuration Store & Endpoints
Store MFS configurations in `cache/mfs-config.json` (with Supabase `mfs_settings` table mirror):

```json
{
  "updatedAt": "2026-10-19T10:15:00.000Z",
  "updatedBy": "admin@gitgrill.com",
  "accounts": [
    {
      "id": "bkash_primary",
      "provider": "bkash",
      "accountNumber": "017XXXXXXXX",
      "accountType": "personal", // 'personal' | 'merchant'
      "instructions": "Go to bKash app -> Send Money -> Enter number -> Use Reference",
      "isActive": true,
      "dailyLimitBdt": 25000,
      "currentDailyTotalBdt": 4389
    },
    {
      "id": "nagad_primary",
      "provider": "nagad",
      "accountNumber": "018XXXXXXXX",
      "accountType": "personal",
      "instructions": "Go to Nagad app -> Send Money -> Enter number -> Use Reference",
      "isActive": true,
      "dailyLimitBdt": 25000,
      "currentDailyTotalBdt": 1197
    }
  ],
  "noticeMessage": "Payment verification takes 10–30 minutes during business hours (10 AM – 11 PM). Immediate 24h provisional Pro access is granted upon submission."
}
```

### 2.3 API Routes:
1. `GET /api/billing/mfs/config` *(Public)*:
   - Returns active MFS accounts and payment instructions for checkout modals.
   - Excludes internal balance totals if sensitive, returns clean payment options.
2. `PUT /api/admin/mfs/config` *(Admin Protected)*:
   - Allows Super Admins to add/edit/disable bKash and Nagad numbers, toggle account types (Personal / Merchant), set notices, or rotate numbers instantly.

---

## 3. Developer Capability Quotas & Metering

The platform tracks and enforces the following capabilities specifically for developers:

| Capability Metric | Free Starter Tier (Generous) | Developer Pro Tier (৳399/mo) | Admin / Super-Admin | Where Enforced |
|---|---|---|---|---|
| **Resume Uploads (`resumes.vault`)** | **3 Resumes** (General, Backend, Frontend) | **20 Resumes** (Full specialization branching) | **Unlimited (∞)** | `frontend/components/ResumeVault.tsx` + `lib/resumes.ts` |
| **Target Role JDs (`target_roles.create`)** | **5 Active JDs** | **50 Active Roles** (Full 30–60 day campaign) | **Unlimited (∞)** | `frontend/components/NewTargetRoleModal.tsx` + `lib/target-roles.ts` |
| **Profile Audits (`audit.run`)** | **10 Audits / month** | **100 Audits / month** (Virtually uncapped daily use) | **Unlimited (∞)** | `backend/src/routes/api.ts` (SSE chokepoint) |
| **Deep Code Audits (`audit.deep_code`)** | **1 Teaser / Trial Audit** | **30 Deep Audits / month** (Full ReAct `src/` traversal) | **Unlimited (∞)** | `backend/src/routes/api.ts` (`/api/deep-audit`) |
| **Resume Tailoring Runs (`resume.tailor`)** | **10 Tailorings / month** | **150 Tailorings / month** | **Unlimited (∞)** | `ResumeTailorModal.tsx` + backend synthesis |
| **Interview Defense Practice (`practice.defense`)** | **25 Flashcards** | **Unlimited Drills & Rehearsals** | **Unlimited (∞)** | `frontend/components/DefenseHub.tsx` |
| **Public Proof Pages (`proof.publish`)** | **3 Active Pages** | **Unlimited Unbranded Proof Pages** | **Unlimited (∞)** | `backend/src/proofs/proof.routes.ts` |

### Dynamic Capability Registry (`cache/tier-limits.json`):
Instead of hardcoding limits in `config/tiers.ts`, the backend loads defaults and merges admin customizations:
- Admins can adjust the default for `Free Starter` or `Developer Pro` on the fly.
- Individual users can have custom overrides in `cache/user-overrides.json` or `user_quotas` table.

---

## 4. Super Admin Console Architecture (`/admin`)

The `/admin` portal expands from a simple MFS approval list into a multi-tab **Platform Operations Command Center**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  GITGRILL PLATFORM OPERATIONS                                         [ Super Admin ]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [ ৳ MFS Approvals ]  [ ⚙️ MFS Accounts ]  [ 👥 User Quotas & Invites ]  [ 🎛️ Tier Rules ]  [ 📊 Telemetry ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Tab 1: MFS Approvals & Verification Ledger (Enhanced)
- Live list of bKash & Nagad submissions (TrxID, phone, username, plan, amount).
- 1-click **Approve** (activates 30d/365d subscription) and **Reject** (revokes 24h grace).
- Filter by provider (bKash vs Nagad), search by TrxID or handle.
- Quick stats: Total BDT Revenue, Pending Submissions, Active Paid Subscribers.

### 4.2 Tab 2: Dynamic MFS Accounts Config
- Form to edit active bKash and Nagad phone numbers.
- Switch between **Personal (Send Money)** and **Merchant (Make Payment)**.
- Toggle active/disabled status (e.g. if one number hits personal daily limits).
- Custom notice banner for checkout modal.

### 4.3 Tab 3: User Quotas & User Invitations
- **Invite User Modal**:
  - Email / GitHub handle.
  - Assigned Tier: `Free Starter`, `Developer Pro (30d)`, `Developer Pro (Annual)`, or `Super Admin`.
  - Optional custom quota grants (e.g. grant 50 audits, 10 resumes).
  - Generates direct invitation/magic access link.
- **User Management Table**:
  - Search by email, GitHub handle, or role.
  - Current usage counters (audits used, resumes uploaded, JDs tracked).
  - Quick action: **"Impose Custom Limit"** or **"Upgrade to Pro"** or **"Revoke Access"**.

### 4.4 Tab 4: Platform Capability Limits & Pricing
- Dynamic sliders / number inputs for:
  - Free Starter resume limit, JD limit, monthly audit limit.
  - Developer Pro resume limit, JD limit, monthly audit limit.
- Toggle feature gates:
  - Enable/disable Tier 2 deep code audit.
  - Enable/disable resume file ingestion.

### 4.5 Tab 5: Telemetry & Quality Assurance
- LLM Provider Health & Latency (Gemini 3.8 Flash, Groq, OpenRouter).
- Failed audit logs with humanized reason vs technical diagnostics.
- Active sessions and daily audit count.

---

## 5. Security & RBAC Enforcement

1. **Client Route Guard ([`frontend/app/admin/billing/page.tsx`](file:///e:/rabby-xponent/Projects/devscope/frontend/app/admin/billing/page.tsx)):**
   - Check `isAdmin(user)`.
   - If not admin, redirect immediately to `/` with toast notification (`Unauthorized`).
   - Remove dependency on purely manual `adminKey` in localStorage; authenticated admin session is the primary gate.

2. **API Endpoint Guard:**
   - All `/api/admin/*` endpoints must verify that `req.user` has `role === 'admin'` or matches `PLATFORM_ADMIN_EMAILS`.
   - Unauthenticated/unauthorized calls receive HTTP 403 Forbidden.

3. **Super Admin Limit Bypass:**
   - In `routes/api.ts` (the audit chokepoint) and `security/usage-ledger.ts`:
     ```typescript
     if (isAdmin(req.user)) {
       // Super admin: zero quota consumption, bypass rate limits, always allow!
       return next();
     }
     ```

---

## 6. Ideas to Improve Admin Capabilities

To make GitGrill an effortlessly managed, highly defensible platform, we propose the following high-impact admin features:

1. **Fraud Detection & Duplicate TrxID Blocker:**
   - Automatically detect if a TrxID has been submitted in the last 60 days.
   - Detect suspicious patterns (e.g. multiple different emails using the exact same phone number).

2. **Impersonate User / "View As" Mode:**
   - Allow super admins to view the developer portal or profile exactly as a specific user sees it to diagnose bug reports or resume tailoring issues.

3. **Promo Code & Campus Ambassador Manager:**
   - Create discount/free promo codes for university coding clubs (e.g. `BUET_DEV`, `DU_CS`, `BRAC_HACKS`) granting 1-month Developer Pro access.

4. **One-Click Data Backup & Export:**
   - Download full JSON/CSV export of all payments, users, and published proof pages with a single click.

5. **LLM Cost & Token Margin Analyzer:**
   - Monitor real-time estimated LLM cost per candidate audit, showing gross profit margin on every ৳399 subscription.

---

## 7. Immediate Execution Phasing

### Phase 1: Pure MFS & Clean De-Stripe / De-Rocket
1. Purge all references to `rocket` and `stripe` across frontend (`billing.ts`, `PricingSection.tsx`, `BkashNagadModal.tsx`, `CheckoutNotice.tsx`, `UpgradeModal.tsx`) and backend.
2. Build `mfs-config` store and API endpoints (`GET /api/billing/mfs/config`, `PUT /api/admin/mfs/config`).
3. Connect `BkashNagadModal.tsx` to read dynamic MFS numbers from the backend.

### Phase 2: Super Admin RBAC & Route Protection
1. Implement route guard on `/admin/*` checking `isAdmin(user)`.
2. Implement super admin quota bypass across backend audit endpoints, resume vault, and target roles.

### Phase 3: Dynamic Limits & User Invitation Engine
1. Implement `tier-limits.json` dynamic config and `user-overrides.json`.
2. Build User Invite & Custom Limits UI in `/admin`.
3. Wire Resume Vault and Target Roles to check dynamic capability limits.
