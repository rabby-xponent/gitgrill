# GitGrill — Role-Based Workspace Segmentation & Tiered Monetization Architecture

> **Document Version:** v2.0 · October 2026  
> **Status:** Architecture Specification & Implementation Blueprint  
> **Core Objective:** Cleanly decouple **Developer CareerOS** (B2C) from **Recruiter TalentOS** (B2B), establish high-ticket recruiter pricing and dedicated developer pricing, enforce role-based access control (RBAC), and strictly gate platform super-admin surfaces.

---

## 1. Strategic Context & Paradigm Shift

### 1.1 The Problem With The Legacy Monolithic Setup
Previously, GitGrill treated all authenticated accounts as generic users. This resulted in several critical UX and product flaws:
1. **Context Pollution:** Developers logging in to audit their GitHub profile were greeted with recruiter workspace switchers and internal platform admin links (`MFS Payments Admin`).
2. **Pricing Misalignment:** A single pricing catalogue was shared across developer individuals and hiring organizations. Displaying consumer developer pricing ($4/mo or ৳399/mo) to recruiters severely under-monetizes enterprise hiring workflows, while displaying corporate pricing to junior engineers repels individual developers.
3. **Security & Information Leaks:** Administrative links (`/admin/billing`) were rendered unconditionally in client-side navigation without role verification.
4. **Stale Billing Copy:** Legacy placeholder pricing strings (e.g. `$14/mo`) contradicted live local pricing (৳399/mo) instead of routing through our unified bKash & Nagad MFS modal.

### 1.2 The Two-Space Model: Developer CareerOS vs Recruiter TalentOS

```
                               ┌────────────────────────────────────────────────────────┐
                               │                GITGRILL IDENTITY GATEWAY               │
                               │           (Supabase Auth + Role Attributes)            │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
                   ┌──────────────────────────────────────┼──────────────────────────────────────┐
                   │                                      │                                      │
                   ▼                                      ▼                                      ▼
     ┌───────────────────────────┐          ┌───────────────────────────┐          ┌───────────────────────────┐
     │    DEVELOPER CAREEROS     │          │    RECRUITER TALENTOS     │          │   PLATFORM SUPER ADMIN    │
     │      (/developer)         │          │       (/recruiter)        │          │      (/admin/billing)     │
     ├───────────────────────────┤          ├───────────────────────────┤          ├───────────────────────────┤
     │ • Personal Job Hunt       │          │ • Job Requisitions        │          │ • MFS Manual Approvals    │
     │ • Target Role Fit Audits  │          │ • Batch Candidate CSV     │          │ • System Usage Telemetry  │
     │ • Codebase Evidence Claims│          │ • Anti-Fraud & Code Rank  │          │ • Transaction Audits      │
     │ • Skill Gap Radar         │          │ • Hiring Manager Dossiers │          │ • Account Role Overrides  │
     │ • Shareable Proof Pages   │          │ • Pipeline Status Kanban  │          │                           │
     ├───────────────────────────┤          ├───────────────────────────┤          ├───────────────────────────┤
     │ Pricing: ৳399/mo ($4/mo)  │          │ Pricing: ৳4,999 - ৳14,990 │          │ Internal Super-Admin Only │
     │ Self-serve / Individual   │          │ Corporate B2B Budget      │          │ Strictly Role-Gated       │
     └───────────────────────────┘          └───────────────────────────┘          └───────────────────────────┘
```

---

## 2. Role-Based Identity & User Segmentation

### 2.1 Role Definitions

Every user profile in Supabase (`auth.users` + `public.profiles` / `app_metadata`) belongs to one of three roles:

| Role | Target Persona | Primary Entry Point | Navigation Scope |
|:---|:---|:---|:---|
| `developer` *(Default)* | Software engineers, students, job hunters. | `/developer` | Personal CareerOS, target roles, proof pages, gap radar. Zero recruiter or admin clutter. |
| `recruiter` | Technical recruiters, HR managers, agency talent scouts, engineering leads. | `/recruiter` | Requisition management, candidate pipeline, CSV bulk import/export, candidate ranking. |
| `admin` | Platform operators, super-admins. | `/admin/billing` | Full platform control, bKash/Nagad verification queue, subscriber management. |

### 2.2 Onboarding & Role Assignment Flow

1. **Default Registration (GitHub / Email OAuth):**
   - When a user signs in via GitHub or standard email magic link on `/` or `/developer`, their role defaults to `developer`.
   - The user immediately enters **Developer CareerOS** (`/developer`).
   - The account dropdown only shows Developer CareerOS context, current developer plan (`Free Starter` or `Developer Pro`), and developer upgrade options.

2. **Recruiter Onboarding Gateway (`/recruiter/join` or `/recruiter`):**
   - Recruiters enter through dedicated landing copy ("GitGrill for Hiring Teams & Recruiters").
   - When signing up for TalentOS, the account metadata stores:
     ```json
     {
       "role": "recruiter",
       "company_name": "Brain Station 23",
       "team_size": "50-200",
       "active_openings": 5
     }
     ```
   - Recruiters receive a tailored Recruiter Navbar and Recruiter Account Menu with team seat management and corporate invoice options.

3. **Super-Admin Protection:**
   - Platform super-admins are validated via:
     1. Supabase `app_metadata.role === 'admin'`.
     2. Hardcoded fallback list in server environment: `PLATFORM_ADMIN_EMAILS="rabby.xponent@gmail.com,admin@gitgrill.com"`.
   - Client-side helper `isAdmin(user)` strictly controls visibility of `/admin/billing`.
   - Server-side and page-level middleware redirects any unauthorized user attempting to access `/admin/*` directly to `/`.

---

## 3. Tiered Monetization & Pricing Architecture

Recruiter workflows carry vastly higher economic value and willingness-to-pay than individual job hunters. Therefore, the pricing models are strictly decoupled.

### 3.1 Developer CareerOS Pricing (B2C Individual)

Aimed at Bangladesh and global engineers preparing for technical interviews and hunting for jobs:

| Plan Name | Price (BDT) | Price (USD) | Quota & Features | Ideal For |
|:---|:---|:---|:---|:---|
| **Free Starter** | **৳0** / forever | **$0** | • **3 fresh profile audits** / 30-day window<br>• 1 active Target Role campaign<br>• 1 shareable public Proof Page<br>• Community LLM synthesis | Engineers checking baseline fit and testing GitGrill. |
| **Developer Pro (Monthly)** | **৳399** / month | **$4** / mo | • **15 fresh deep audits** / month<br>• **10 active Target Roles**<br>• Unlimited shareable Proof Pages<br>• Deep source code inspection (`src/`, `lib/`)<br>• Interactive Code Defense drills<br>• PDF Export | Active job seekers interviewing over the next 1–3 months. |
| **Developer Pro (Annual)** | **৳3,490** / year | **$35** / yr | • All Pro Monthly features<br>• 27% annual savings (~৳290/mo)<br>• Priority LLM compute queue | Long-term career tracking and portfolio maintenance. |
| **Job Hunt Season Pass** *(Special)* | **৳899** / 3 months | **$9** / 3 mo | • Complete 90-day job hunt coverage<br>• 45 audits total across 90 days | Candidates running intensive application cycles. |

---

### 3.2 Recruiter TalentOS Pricing (Accessible to Individual Recruiters & Teams)

Recruiters are often individual talent scouts, freelance headhunters, in-house tech HR specialists, or engineering managers who want to eliminate manual resume screening and make their daily workflow 10x faster. We ensure recruiter pricing is reasonable and self-serve, rather than strictly locked behind corporate enterprise gates:

| Plan Name | Price (BDT) | Price (USD) | Quota & Capabilities | Target Persona |
|:---|:---|:---|:---|:---|
| **Recruiter Free Trial** | **৳0** (7 Days) | **$0** | • 5 Candidate verification audits<br>• 1 active Job Requisition<br>• Candidate fit matrix & gap overview | Individual recruiters testing the platform on active openings. |
| **Recruiter Starter (Individual)** *(Most Popular)* | **৳1,490** / month | **$14** / month | • **35 Candidate Audits** / month<br>• **3 Active Job Requisitions**<br>• CSV Candidate Batch Upload & Sample CSV download<br>• Requisition Fit Calibration<br>• CSV & PDF Candidate Dossier Export<br>• Single user workspace | **Individual tech recruiters, freelance headhunters, startup engineering leads** who want an unfair screening advantage. |
| **Recruiter Growth (High Volume)** | **৳3,990** / month | **$38** / month | • **120 Candidate Audits** / month<br>• **10 Active Job Requisitions**<br>• Full Batch CSV Screening & Auto-Ranking<br>• Anti-fraud & Fork-padding detection score<br>• Priority LLM deep audit queue<br>• Shareable Candidate Brief links for Hiring Managers | High-volume recruiters, active hiring sprints, boutique recruitment desks. |
| **Recruiter Team / Agency** | **৳9,990** / month | **$95** / month | • **350 Candidate Audits** / month<br>• Unlimited Job Requisitions<br>• 3 Team seats included (+৳1,990/extra seat)<br>• Unified candidate pool & collaborative notes<br>• ATS export & webhook integration | Recruitment agencies and growing engineering departments. |

> [!NOTE]
> **Key Philosophy:** An individual recruiter should be able to pay for Recruiter Starter on their personal bKash/Nagad or credit card without needing enterprise procurement, purchase orders, or company approval.

---

## 4. UI/UX Account Menu & Navigation Specifications

### 4.1 Developer Account Dropdown (`/developer`)
When an engineer clicks their avatar in the Developer Workspace:
```
┌───────────────────────────────────────────────┐
│ SIGNED IN AS                                  │
│ engineer@example.com                          │
├───────────────────────────────────────────────┤
│ ACTIVE WORKSPACE                              │
│ ⎇ Developer CareerOS                (Active)  │
├───────────────────────────────────────────────┤
│ PLAN STATUS                                   │
│ Starter Free (1 of 3 audits used)             │
│                                               │
│ [ ⚡ Upgrade to Developer Pro — ৳399/mo ]     │
├───────────────────────────────────────────────┤
│ 💼 Hiring developers? Go to Recruiter Portal →│
├───────────────────────────────────────────────┤
│ ↪ Sign out                                    │
└───────────────────────────────────────────────┘
```
**Key UX Rules:**
1. **No Admin Link:** Under no circumstances does `/admin/billing` appear for non-admin users.
2. **Accurate Plan Label:** Never show `ANONYMOUS` for a signed-in user. Show `Free Starter` or `Developer Pro`.
3. **Localized Upgrade Button:** Shows `৳399/mo` ($4/mo), and clicking it triggers the **unified payment modal** (supporting bKash, Nagad, Rocket, or Card).
4. **Subtle Recruiter Link:** Recruiter portal is offered as a subtle single-line exit link (`Hiring developers? Go to Recruiter Portal →`), rather than an equal-weight workspace switcher that confuses candidates.

### 4.2 Recruiter Account Dropdown (`/recruiter`)
When a recruiter accesses their menu:
```
┌───────────────────────────────────────────────┐
│ SIGNED IN AS                                  │
│ recruiter@techagency.com                      │
├───────────────────────────────────────────────┤
│ ACTIVE RECRUITER SPACE                        │
│ 🏢 TalentOS — Brain Station 23                │
├───────────────────────────────────────────────┤
│ RECRUITER PLAN                                │
│ Recruiter Solo (12 of 40 candidate audits)    │
│                                               │
│ [ ⚡ Manage Talent Plan / Buy Candidates ]    │
├───────────────────────────────────────────────┤
│ 🧑‍💻 Switch to Personal Developer Profile →    │
├───────────────────────────────────────────────┤
│ ↪ Sign out                                    │
└───────────────────────────────────────────────┘
```

### 4.3 Super-Admin Account Dropdown
For users where `isAdmin(user) === true`:
```
┌───────────────────────────────────────────────┐
│ SIGNED IN AS (SUPER ADMIN)                    │
│ admin@gitgrill.com                            │
├───────────────────────────────────────────────┤
│ PLATFORM OPERATIONS                           │
│ ৳ MFS Payments Verification Ledger            │
│ ⚙️ System & Telemetry Controls                 │
├───────────────────────────────────────────────┤
│ WORKSPACES                                    │
│ ⎇ Developer CareerOS                          │
│ 🏢 Recruiter TalentOS                         │
├───────────────────────────────────────────────┤
│ ↪ Sign out                                    │
└───────────────────────────────────────────────┘
```

---

## 5. Technical Implementation Blueprint

### Step 1: Admin Gating Helper (`frontend/lib/admin.ts`)
```typescript
import { SessionUser } from './auth';

const ADMIN_EMAILS = [
  'admin@gitgrill.com',
  'rabby.xponent@gmail.com',
  ...(process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
].filter(Boolean);

export function isAdmin(user: SessionUser | null): boolean {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase();
  const hasAdminEmail = ADMIN_EMAILS.includes(email);
  const hasAdminRole = (user as any).app_metadata?.role === 'admin' || (user as any).role === 'admin';
  return hasAdminEmail || hasAdminRole;
}
```

### Step 2: Fix Entitlements Fallback (`frontend/lib/entitlements.ts` & `useEntitlements.ts`)
- Replace the hardcoded `localEntitlements(false)` with the actual session status.
- Ensure signed-in users with zero subscription record default to `starter` (`tier: 'starter'`), never `anonymous`.

### Step 3: Decouple Catalogue in `backend/src/config/plans.ts`
- Introduce `DEVELOPER_PLANS` and `RECRUITER_PLANS`:
  - `dev_pro_monthly`: `display: '$4/mo'`, `displayBdt: '৳399/mo'`, `bdtAmount: 399`
  - `dev_pro_annual`: `display: '$35/yr'`, `displayBdt: '৳3,490/yr'`, `bdtAmount: 3490`
  - `recruiter_solo`: `display: '$49/mo'`, `displayBdt: '৳4,999/mo'`, `bdtAmount: 4999`
  - `recruiter_agency`: `display: '$149/mo'`, `displayBdt: '৳14,990/mo'`, `bdtAmount: 14990`

### Step 4: Protect Admin Routes (`frontend/app/admin/billing/page.tsx`)
- Add page-level guard checking `isAdmin(user)`:
  - If loading: show skeleton.
  - If not admin: redirect to `/` with a warning notification.

---

## 6. Execution Roadmap

| Phase | Milestone | Deliverables |
|:---|:---|:---|
| **Phase 1** *(Immediate)* | **UI Cleanup & Admin Lockdown** | • Remove `/admin/billing` from public user menus.<br>• Add `isAdmin` check.<br>• Fix `ANONYMOUS` plan label bug for signed-in users.<br>• Update `AccountMenu.tsx` to show Developer Pro ৳399/mo. |
| **Phase 2** *(Current Sprint)* | **Developer Focus Realignment** | • Refactor `AccountMenu.tsx` to prioritize Developer CareerOS.<br>• Connect upgrade button directly to the unified bKash/Nagad/Card modal.<br>• Ensure target role limit and audit quota reflect Developer Free/Pro accurately. |
| **Phase 3** *(Next Sprint)* | **Recruiter TalentOS Modernization** | • Separate `/recruiter` pricing matrix with Solo & Agency tiers.<br>• Recruiter onboarding flow with company metadata.<br>• Batch candidate CSV processing and hiring manager export. |
