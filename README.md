# GitGrill

<div align="center">

**AI-Native Technical Talent Intelligence & Developer CareerOS**

*Transforming GitHub repositories and resumes into verifiable engineering intelligence, deep code audits, and tailored career trajectories.*

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Architecture](https://img.shields.io/badge/Agent-Autonomous%20ReAct-ff6b6b?style=flat-square)](docs/DEVSCOPE_SPEC.md)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-gitgrill--gr.vercel.app-success?style=flat-square)](https://gitgrill-gr.vercel.app)
[![Dossier](https://img.shields.io/badge/System-Build%20Dossier-00C7B7?style=flat-square)](https://gitgrill-gr.vercel.app/dossier)

[Live Demo](https://gitgrill-gr.vercel.app) • [Build Dossier](https://gitgrill-gr.vercel.app/dossier) • [Overview](#overview) • [Key Capabilities](#key-capabilities) • [Architecture](#architecture) • [Quickstart](#local-quickstart) • [Docs & Specs](#technical-specifications) • [Author](#author)

</div>

---

> 🌐 **Live Production Application:** [**gitgrill-gr.vercel.app**](https://gitgrill-gr.vercel.app)  
> 💡 **For Recruiters & Hiring Managers:** Check out the live interactive [**Engineering Build Dossier**](https://gitgrill-gr.vercel.app/dossier) for an executive technical briefing, system metrics, design trade-offs, and architecture benchmarks.

---

## Overview

Technical hiring is fundamentally asymmetric. Candidates present static, unverified 2-page PDFs; recruiters sift through keyword-stuffed resumes without knowing whether production code exists; and engineering leaders spend valuable cycles in mismatched phone screens.

**GitGrill** solves this asymmetry with a dual-sided intelligence platform:

1. **RecruiterOS Command Center**: Dissects any public GitHub profile using an autonomous ReAct agent. It navigates commit histories, diffs, repository architecture, and code density to construct a **Claim vs. Evidence Matrix**, benchmark candidates against custom seniority rubrics, and generate interview cheat-sheets with line-level code citations.
2. **Developer CareerOS**: An intelligent career cockpit for software engineers. It features an **Immutable Resume Vault** with deterministic 2D coordinate PDF extraction and Mammoth DOCX AST parsing, real-time Job Fit Pre-Flight scoring, non-destructive variant branching (`v1.0` → `v1.1`), and cryptographic public proof pages.

---

## Key Capabilities

### 🔍 RecruiterOS — Talent Intelligence & Code Defense
- **Autonomous Deep Code Audit**: A 2-tier ReAct agent loop equipped with 14 specialized tools (commit diff analyzer, AST parser, line-bounded code fetcher, contribution graph auditor, social footprinting via HN Algolia & DEV.to).
- **Claim vs. Evidence Matrix**: Cross-references resume assertions (e.g., *"Engineered high-throughput distributed message queue"*) against verified git commits and repository implementations to flag hype vs. reality.
- **Custom Seniority Rubrics**: Grade candidates according to internal engineering standards (e.g., Distributed Systems L5, Frontend Systems L4) rather than superficial vanity stars.
- **Interview Flight Plans & Cheat Sheets**: Generates targeted 15-minute technical phone screen questions with anticipated strong answers, red flags, and line-level code citations.
- **Executive 1-Click Export**: Generates recruiter summaries and one-page Engineering Manager briefs in seconds.

### 🚀 Developer CareerOS — Career Cockpit & Proof Pages
- **Immutable Resume Vault**: Ingests resumes via a deterministic 2D coordinate layout engine (PDF) and Mammoth AST walker (DOCX), cleanly isolating Contact, Summary, Experience, Projects, Skills, and Education.
- **AI Job Fit Pre-Flight**: Real-time rubric-driven evaluation of candidate resumes against any target Job Description (JD), calculating hard requirements, keyword alignment, and code evidence match scores.
- **Variant Studio**: Create target-tailored, non-destructive resume branches (e.g., `v1.0 Master` → `v1.1 FinTech Lead`) without losing master history.
- **Inline Rich Editing**: Deep structured editing of project and experience bullet points with live character counting, STAR framework enforcement, and instantaneous diff previews.
- **Public Proof Pages**: Cryptographically verifiable public URLs showcasing confirmed project code, commit activity, and verified skill signals.

---

## Architecture

GitGrill separates high-frequency stateless aggregations from deep autonomous reasoning via a **two-tier pipeline** connected over Server-Sent Events (SSE).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           Next.js 14 Frontend                          │
 │      App Router • Tailwind CSS • Framer Motion • Lucide • SSE Stream   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │  SSE / REST
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         Express Backend Gateway                        │
 │           Auth & RLS Middleware • Rate Limiting • Job Queue            │
 └───────────────────┬────────────────────────────────┬───────────────────┘
                     │                                │
                     ▼                                ▼
       ┌───────────────────────────┐    ┌───────────────────────────┐
       │   Tier 1: Fast Profiler   │    │  Tier 2: ReAct Auditor    │
       │   Stateless concurrent    │    │  Autonomous loop with 14  │
       │   GitHub API aggregators  │    │  read-only tools & AST    │
       │   (Repos, Commits, PRs)   │    │  navigation (Bounded Buf) │
       └─────────────┬─────────────┘    └─────────────┬─────────────┘
                     │                                │
                     └────────────────┬───────────────┘
                                      ▼
       ┌────────────────────────────────────────────────────────────┐
       │             Provider-Agnostic LLM Gateway                  │
       │  Automatic Cascade & Failover:                             │
       │  Groq (Llama 3.3) ──▶ OpenRouter ──▶ DeepSeek ──▶ Gemini   │
       │  Sliding-window context compression (~95% token reduction) │
       └──────────────────────────────┬─────────────────────────────┘
                                      │
                                      ▼
       ┌────────────────────────────────────────────────────────────┐
       │              Storage & Data Layer                          │
       │  Supabase (PostgreSQL + Row-Level Security)                │
       │  Deterministic Resume AST Cache (File / Memory TTL)        │
       └────────────────────────────────────────────────────────────┘
```

### Architectural Highlights
- **Two-Phase Agent (No Token Blowup)**: Raw tool executions are buffered in-memory; only structured summaries (~2KB) remain in the active LLM context. Synthesis runs as an isolated final step, eliminating context exhaustion and keeping per-run costs minimal.
- **Multi-Model Failover Gateway**: Zero vendor lock-in. The backend cascade attempts ultra-fast inference (Groq Llama-3.3-70B), automatically failing over to OpenRouter, DeepSeek-V3, and Gemini 2.5 Flash on rate limits or outages.
- **2D Coordinate PDF Reconstruction**: Resolves multi-column PDFs by sorting text runs by vertical baseline ($y$) and horizontal offset ($x$), eliminating column blending that breaks standard PDF text extractors.
- **Bangladesh MFS Monetization Rail**: Enterprise team seats and solo recruiter tiers integrated with bKash and Nagad MFS (BDT) with 24-hr instant provisional access for seamless SaaS operations.

---

## Engineering Build Dossier

For technical recruiters and engineering managers reviewing this repository, the **Build Dossier** is embedded directly within the application:

- **Route:** [`/dossier`](file:///frontend/app/dossier/page.tsx)
- **Component:** [`EngineeringDossier.tsx`](file:///frontend/components/EngineeringDossier.tsx)
- **Specification:** [`docs/DEVSCOPE_SPEC.md`](file:///docs/DEVSCOPE_SPEC.md)

It contains interactive architectural diagrams, real-time tool trace demonstrations, LLM latency benchmarks, and verified engineering decisions.

---

## Project Structure

```
devscope/
├── backend/                        # Express API & Agent Core (TypeScript)
│   ├── src/
│   │   ├── agent/                  # Autonomous ReAct loop, 14 tools, system prompts
│   │   ├── auth/                   # Supabase authentication & RLS schema
│   │   ├── cache/                  # Fast file-based & in-memory TTL caching
│   │   ├── llm/                    # Provider-agnostic LLM gateway (Groq, Gemini, DeepSeek)
│   │   ├── routes/                 # SSE stream endpoints, profile API, resume API
│   │   ├── services/               # GitHub API client, AST parser, PDF/DOCX extractors
│   │   └── types/                  # Domain TypeScript interfaces & schemas
│   └── tests/                      # Unit & integration test suites
│
├── frontend/                       # Next.js 14 App Router (React, Tailwind, Framer Motion)
│   ├── app/
│   │   ├── page.tsx                # High-conversion landing page (Dual Workspace)
│   │   ├── profile/[username]/     # Live agent trace & candidate profile view
│   │   ├── workspace/              # Developer CareerOS cockpit & Resume Vault
│   │   ├── recruiter/              # RecruiterOS dashboard & Candidate Command Center
│   │   ├── dossier/                # Live interactive Engineering Build Dossier
│   │   └── auth/                   # Supabase authentication & session callback
│   ├── components/                 # UI components (AgentTrace, ResumeEditor, FitScore, etc.)
│   ├── hooks/                      # Custom hooks (SSE stream, debounce, audio)
│   └── lib/                        # Resume parser AST, Supabase client, dossier data
│
└── docs/                           # Technical Specifications & System Architecture
    ├── DEVSCOPE_SPEC.md            # Foundational system architecture & agent loop
    ├── DEVELOPER_CAREER_OS_SPEC.md # CareerOS specification, AST schemas & workflows
    ├── ROLE_BASED_WORKSPACES...    # Dual workspace & monetization specification
    ├── MONETIZATION_ARCHITECTURE.md# Bangladesh MFS (bKash & Nagad) payment workflows
    └── ROADMAP.md                  # Product roadmap & feature milestones
```

---

## Local Quickstart

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**
- **GitHub Personal Access Token**: (with `public_repo` read permissions)
- **At least one LLM API Key**: Google Gemini (free tier), Groq, OpenRouter, or DeepSeek

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

Configure your `.env` with your preferred LLM provider and GitHub token:
```ini
PORT=4000
FRONTEND_URL=http://localhost:3000
GITHUB_TOKEN=ghp_your_personal_access_token
GEMINI_API_KEY=your_gemini_api_key
# Optional: GROQ_API_KEY, OPENROUTER_API_KEY, DEEPSEEK_API_KEY
```

Run the backend development server:
```bash
npm run dev
```

Verify the agent standalone directly in your terminal:
```bash
npm run agent:test torvalds
```

### 2. Frontend Setup
```bash
cd ../frontend
npm install
cp .env.local.example .env.local
```

Configure `frontend/.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:4000
# Optional: Supabase credentials for persistent workspace authentication
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Description | Default |
|---|---|---|
| `PORT` | API server listen port | `4000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `GITHUB_TOKEN` | GitHub PAT (`public_repo` read scope) | Required |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key | Optional |
| `GROQ_API_KEY` | Groq Cloud API Key (Llama 3.3 70B) | Optional |
| `OPENROUTER_API_KEY` | OpenRouter Multi-Provider Key | Optional |
| `DEEPSEEK_API_KEY` | DeepSeek API Key (DeepSeek-V3) | Optional |
| `LLM_PROVIDER_OVERRIDE`| Force a specific provider for testing | Auto-failover |
| `CACHE_TTL_HOURS` | Profile cache retention in hours | `24` |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Express API gateway endpoint |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Auth & Database) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous API key |

---

## Technical Specifications

The engineering decisions behind GitGrill are documented in detail within the [`docs/`](./docs) directory:

| Document | Description |
|---|---|
| [**System Specification**](./docs/DEVSCOPE_SPEC.md) | Two-tier ReAct agent, tool execution protocols, synthesis pipeline |
| [**Developer CareerOS Spec**](./docs/DEVELOPER_CAREER_OS_SPEC.md) | Deterministic Resume AST, 2D PDF coordinates, Mammoth DOCX, Variant Studio |
| [**Workspaces & Pricing**](./docs/ROLE_BASED_WORKSPACES_AND_PRICING_SPEC.md) | Dual workspace architecture (Recruiter vs Developer) & pricing models |
| [**Monetization Architecture**](./docs/MONETIZATION_ARCHITECTURE.md) | Bangladesh MFS (bKash & Nagad) payment workflows, entitlement enforcement |
| [**Product Roadmap**](./docs/ROADMAP.md) | Milestone history, technical achievements, and upcoming capabilities |

---

## Author

**Golam Rabby**  
*Full-Stack & Systems Engineer*  
- **GitHub:** [@rabby-xponent](https://github.com/rabby-xponent)

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
