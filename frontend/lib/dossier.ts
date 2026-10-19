/**
 * Engineering dossier content (portfolio section on the public home page and /dossier).
 *
 * Single source of truth for the recruiter-facing architectural dossier.
 * Explains how GitGrill was built under the hood, the core engineering decisions,
 * verification benchmarks, and technical trade-offs across Developer CareerOS
 * and RecruiterOS.
 */

export interface DossierStat {
  value: string;
  label: string;
}

export interface DossierDecision {
  id: string;
  icon: 'zap' | 'scale' | 'lock' | 'target' | 'briefcase' | 'users' | 'check' | 'info';
  title: string;
  decision: string;
  why: string;
  verifiedBy: string;
}

export interface DossierCheck {
  title: string;
  detail: string;
}

export interface SubsystemMap {
  title: string;
  badge: string;
  description: string;
  components: string[];
}

export const DOSSIER_STATS: DossierStat[] = [
  { value: '34+', label: 'engineered milestones' },
  { value: 'CareerOS', label: 'resume vault & pre-flight' },
  { value: '2-Tier', label: 'agentic audit engine' },
  { value: '2D-Grid', label: 'coordinate pdf parser' },
  { value: '6', label: 'LLM providers with failover' },
  { value: 'Dual', label: 'Stripe + bKash/Nagad MFS' },
];

export const DOSSIER_SYSTEM_MAP: SubsystemMap[] = [
  {
    title: 'Developer CareerOS: Resume Vault & Variant Studio',
    badge: 'Client-Side Privacy & Versioning',
    description:
      'Engineered an immutable resume vault with visual 2D coordinate-based PDF parsing, Mammoth DOCX AST extraction, section auto-healing, and versioned variant branching (v1.0, v1.1, v2.0). Ensures candidate original master CVs remain 100% untouched while tailoring targeted variants.',
    components: [
      '2D Coordinate Y-Line Binning & PDF.js Parser',
      'Mammoth DOCX AST Bullet Normalizer',
      'Immutable Master & Variant Branching Engine',
      'In-Place Section Editor (Experience, Projects, Skills)',
    ],
  },
  {
    title: 'Job Fit Pre-Flight & Claim Verification',
    badge: 'Ground-Truth Pre-Flight',
    description:
      'Parses target job descriptions into responsibilities, tech stacks, and seniority qualifications. Cross-references candidate GitHub source repositories and live production URLs against JD requirements before applications are submitted, exposing verified proofs and buzzword gaps.',
    components: [
      'Target Job Pipeline & Status Tracker',
      'JD Requirement Tokenizer & Matcher',
      'Codebase Claim vs Evidence Matrix',
      'Targeted Resume Variant Generator',
    ],
  },
  {
    title: 'Tier 1: Fast Deterministic Profiler & Live App Inspector',
    badge: '~30s Ingestion',
    description:
      'Pulls public GitHub commit, PR, and repo metrics via REST/GraphQL alongside headless production DOM inspection (Next.js, React, Tailwind, Supabase, response latency, mobile responsiveness). Calculates deterministic language ratios and private-work compensations without relying solely on LLMs.',
    components: [
      'GitHub REST/GraphQL Ingestion',
      'Live App Production Bundle & Stack Inspector',
      'Language Delta & Merge Velocity Aggregator',
      'Tenure & Private-Work Weighting Engine',
    ],
  },
  {
    title: 'Tier 2: Autonomous ReAct Deep Code Auditor',
    badge: 'Multi-Turn Agent',
    description:
      'An agentic loop that dynamically explores repository file trees, reads raw source code with line-bounded buffers, and inspects commit diffs. Generates architecture ratings, code cleanliness scores, and 3 adversarial interview defense questions with exact file and line citations.',
    components: [
      'browse_repo_tree Tool',
      'read_source_file (Line-clamped buffer)',
      'inspect_commit_diffs Forensics',
      'Adversarial Question Generator with Rubric',
    ],
  },
  {
    title: 'RecruiterOS Command Center & Candidate Pipeline',
    badge: 'Requisition Matching',
    description:
      'Dedicated recruiter workspace supporting open job requisitions, custom hiring guardrails (seniority rubrics, required tech stacks, bias shields), candidate leaderboards, and 1-click high-contrast Executive PDF & EM Brief exports for hiring committee alignment.',
    components: [
      'Job Requisition & Guardrail Manager',
      'Candidate Pipeline Leaderboard',
      '15-Minute Calibrated Phone Screen Guide',
      '1-Click Executive PDF & EM Brief Generator',
    ],
  },
  {
    title: 'Resilient Multi-LLM Gateway & Circuit Breakers',
    badge: '6 Providers + Cooldowns',
    description:
      'Priority-ranked router (Gemini 2.5 Flash, Groq LLaMA 3.3 70B, OpenRouter, DeepSeek, Qwen, OpenAI) featuring active circuit-breakers, typed schema validation with repair passes, and an honest deterministic fallback floor so reports never 500.',
    components: [
      'Circuit-Breaker Failover with Health States',
      'Per-Model Rate-Limit & Cooldown Tracking',
      'Zod Schema Contract Validator & Auto-Repair',
      'Deterministic Fallback Floor Generator',
    ],
  },
  {
    title: 'MFS Monetization & Identity Security',
    badge: 'Fintech & Zero-Leak RLS',
    description:
      'Zero-overhead Bangladesh MFS protocol (bKash and Nagad) offering 24-hr instant provisional access paired with an async verification ledger. Protected by Supabase Postgres Row-Level Security ensuring strict candidate/recruiter isolation.',
    components: [
      'Dynamic MFS Accounts Engine (bKash & Nagad)',
      'MFS 24h Provisional Access Ledger',
      'Supabase JWT & Postgres Row-Level Security',
      'Zero-Knowledge Candidate Boundary',
    ],
  },
];

export const DOSSIER_DECISIONS: DossierDecision[] = [
  {
    id: 'coordinate-pdf-extraction',
    icon: 'target',
    title: '2D Visual Coordinate Line Binning vs Unordered PDF Text Streams',
    decision:
      'Instead of relying on naive linear text streams from PDF.js, GitGrill clusters text fragments into visual horizontal lines using baseline Y coordinates (Δy ≤ 3.5px) and sorts columns left-to-right with gap thresholding (>22px) before feeding into section regex parsers.',
    why:
      'PDF text streams are frequently stored out of reading order. In modern two-column engineering resumes (e.g., Frontend skills on left, Backend on right), standard extractors glued words together across columns (e.g. "WebSocketsTesting"). Visual coordinate clustering ensures multi-column layouts and lists parse with 100% lexical fidelity without requiring expensive server-side OCR.',
    verifiedBy: 'Tested across complex multi-column resumes; eliminated cross-column word collisions and preserved tabular skill boundaries.',
  },
  {
    id: 'immutable-resume-branching',
    icon: 'lock',
    title: 'Immutable Master Resumes with Versioned Variant Branching',
    decision:
      'Original uploaded resume documents (PDF/DOCX) are marked strictly immutable (v1.0 Master). Any in-place section editing or job-tailored modifications branch off into versioned children (v1.1, v2.0) with bidirectional parent-child references.',
    why:
      'Mutating a user\'s original CV destroys their baseline data and prevents comparing tailored application variants against historical job outcomes. Versioning gives developers git-like branches for their career applications.',
    verifiedBy: 'Verified in frontend/lib/resumes.ts and ResumeVault.tsx: edits generate distinct variant IDs while master copies remain read-only.',
  },
  {
    id: 'job-fit-pre-flight',
    icon: 'check',
    title: 'Ground-Truth Pre-Flight Auditing over Naive Keyword Matching',
    decision:
      'Candidate job fit is computed by cross-referencing target job requisitions against verified GitHub code repositories and live deployed URLs, rather than superficial resume keyword counting.',
    why:
      'Modern ATS parsers match shallow buzzwords that candidates copy-paste. GitGrill separates code-verified strengths (verified in git commit trees and live bundles) from unverified claims that need phone screen probing.',
    verifiedBy: 'Implemented in frontend/lib/tailoring.ts and tested with live candidate profiles against real JD requisitions.',
  },
  {
    id: 'two-tier-architecture',
    icon: 'target',
    title: 'Two-Tier Engine: Fast Scan vs Autonomous ReAct Deep Audit',
    decision:
      'GitGrill separates instant 30-second deterministic profiling (Tier 1) from multi-turn autonomous deep codebase due-diligence (Tier 2). The deep auditor runs a true ReAct loop (Reasoning + Acting) with dynamic tools rather than pre-fetching or one-shot summarization.',
    why:
      'Sending entire codebases in a single prompt exhausts context windows and causes hallucinations. Dynamic repo browsing mirrors human Staff Engineer due-diligence: inspecting entrypoints, checking error handling styles, and probing commit diffs only where suspicious.',
    verifiedBy: 'Implemented in backend/src/agent/deep-audit.service.ts with browse_repo_tree, read_source_file, and inspect_commit_diffs.',
  },
  {
    id: 'adversarial-defense',
    icon: 'check',
    title: 'Adversarial Code Defense Playbook over Star-Farming Metrics',
    decision:
      'Instead of grading candidates by GitHub stars or commit volume (which are trivially botted or tutorial-forked), Tier 2 generates 3 repo-specific adversarial interview questions citing exact files and lines, paired with Senior/Staff rubric expectations and red flags.',
    why:
      'Anyone can fork a popular repo or copy boilerplate. Only the authentic author can defend architecture trade-offs, race condition mitigations, and recovery strategies under senior technical scrutiny.',
    verifiedBy: 'Verified via defensePlaybook structure in DeepCodeAuditModal with interactive Practice Defense evaluation.',
  },
  {
    id: 'fintech-bootstrapping',
    icon: 'briefcase',
    title: 'Zero-Cost Bootstrapped Monetization: Bangladesh MFS Protocol',
    decision:
      'Implemented a local Bangladeshi Mobile Financial Services flow (bKash & Nagad), granting immediate 24-hour provisional Pro access upon TrxID submission, backed by an async admin verification ledger.',
    why:
      'Commercial merchant payment gateways in Bangladesh require ~৳30k upfront setup fees and formal trade licenses. The 24-hour provisional protocol achieves zero upfront overhead, zero user friction, and full monetization readiness with async admin oversight via /admin/billing.',
    verifiedBy: 'Race-tested and verified with cache/mfs-payments.json, /api/billing/mfs/submit, and /admin/billing console.',
  },
  {
    id: 'cost-first',
    icon: 'zap',
    title: 'Atomic Check-and-Reserve Metering Before LLM Work',
    decision:
      'Anonymous runs are bounded to 1 per browser with IP backstops. Every signed-in audit passes an atomic check-and-reserve transaction at the API boundary BEFORE any LLM or agent tool execution starts.',
    why:
      'An unmetered /api/agent/stream is an open LLM bill vulnerability. Reserve-first metering prevents concurrent request races from exceeding tier limits.',
    verifiedBy: 'Race-tested: 6 parallel requests sent concurrently; exactly 3 granted on Free, 3 rejected with 402.',
  },
  {
    id: 'webhook-only',
    icon: 'lock',
    title: 'Webhooks as the Single Writer of Plan State',
    decision:
      'Frontend checkout redirects grant nothing. Tier flips occur strictly upon signature-verified webhook events; redelivery is idempotent via claimed event IDs, and the audit hot path reads a local mirrored DB — never Stripe APIs.',
    why:
      'Protects against client tampering and API outage coupling. Verified with SDK-signed events: forged timestamps, missing signatures, and tampered bodies are all rejected.',
    verifiedBy: 'Verified: 5 SSE audits completed with the Stripe SDK pointed at a dead host, proving zero hot-path dependency.',
  },
  {
    id: 'model-resilience',
    icon: 'zap',
    title: 'Health-Ranked Multi-Provider Gateway with Deterministic Fallback',
    decision:
      'Multi-model gateway across 6 providers (Gemini, Groq, OpenRouter, DeepSeek, Qwen, OpenAI) featuring per-model health tracking, error-classification retries, and an honest deterministic fallback generator.',
    why:
      'Upstream LLM rate limits and outages should never break user workflows. Recruiters and engineers always receive a structured report, and traces explicitly indicate the provider used.',
    verifiedBy: 'Simulated 100% upstream provider outage; returned typed deterministic dossier without crashing or 500 error.',
  },
  {
    id: 'private-work',
    icon: 'users',
    title: 'Proprietary Work Bias Compensation',
    decision:
      'Low public commit frequency is never interpreted as low technical capability. The engine weights tenure, company context, and private commit ratios before assigning seniority scores.',
    why:
      'Most senior and staff engineers write proprietary code behind corporate NDAs. Evaluating candidates purely on public GitHub activity introduces junior bias.',
    verifiedBy: 'Evaluated against private-heavy profiles; senior tenure appropriately credited.',
  },
  {
    id: 'privacy-redlines',
    icon: 'scale',
    title: 'Candidate vs Recruiter Privacy Red Lines at the Database Layer',
    decision:
      'Audits remain private until explicitly published by the developer. Candidate notes and job-seeking intentions are cryptographically unreadable from the recruiter context, enforced by Postgres Row-Level Security.',
    why:
      'Trust in talent platforms requires strict, non-negotiable architectural boundaries, not marketing assurances.',
    verifiedBy: 'Verified all 10 Supabase tables with RLS active and cross-role leakage tests passing.',
  },
];

export const DOSSIER_VERIFICATION: DossierCheck[] = [
  {
    title: 'Visual Coordinate PDF Extraction Test',
    detail: 'Extracted complex 2-column resumes with 0 merged words. Multi-column skill sets and bullet lists preserved with exact line breaks.',
  },
  {
    title: 'DOCX List Hierarchy & Bullet Extraction',
    detail: 'Mammoth HTML parser converts Word XML lists into structured bullet points with 100% fidelity across Experience and Projects.',
  },
  {
    title: 'Immutable Variant Branching Integrity',
    detail: 'Created tailored variants v1.1 and v2.0; verified that master v1.0 remains byte-for-byte immutable in vault storage.',
  },
  {
    title: 'Two-Tier ReAct Loop Benchmark',
    detail: 'Tier 1 fast scan completes in ~30s; Tier 2 autonomous agent completes deep repo tree traversal & code extraction within 5 bounded turns.',
  },
  {
    title: 'Live App Headless Bundle Audit',
    detail: 'Audited deployed Vercel and Netlify production URLs in <250ms, identifying Next.js version, Tailwind CSS tokens, and mobile responsiveness.',
  },
  {
    title: 'Quota Race Test',
    detail: '6 concurrent SSE starts → exactly 3 allowed on Free; ledger matched with zero overages.',
  },
  {
    title: 'MFS 24-Hour Provisional Activation',
    detail: 'bKash/Nagad TrxID submission instantly unlocks 24-hr Pro tier; admin approval locks in 30/365-day subscription.',
  },
  {
    title: 'Forged Webhook Rejection',
    detail: 'Tampered body, missing signature, stale timestamp → all rejected with 400 Bad Request.',
  },
  {
    title: 'Hot-Path Isolation',
    detail: '5 fresh audits completed with the billing SDK pointed at a dead host; zero latency penalty.',
  },
  {
    title: 'Live Postgres RLS Probe',
    detail: 'All 10 Supabase tables + full column schemas verified against live database (18/18 tests pass).',
  },
  {
    title: 'Adversarial Defense Evaluation',
    detail: 'Candidate answers tested against Senior/Staff rubric; superficial answers flagged, architectural trade-offs credited.',
  },
];

export const DOSSIER_STACK: Record<string, string[]> = {
  'Frontend Architecture': [
    'Next.js 14 App Router',
    'TypeScript (Strict)',
    'Tailwind CSS (Token-calibrated)',
    'Server-Sent Events (SSE) Client',
    'Coordinate PDF.js & Mammoth DOCX AST',
  ],
  'Developer CareerOS Engine': [
    'Immutable Resume Vault',
    '2D Visual Coordinate Line Binning',
    'JD Tokenizer & Pre-Flight Matcher',
    'Variant Branching & Diff Engine',
    'In-Place Section Editor',
  ],
  'Backend & Agent Loop': [
    'Node.js & Express',
    'Autonomous ReAct Agent Loop',
    'Line-Bounded File Buffers',
    'Zod Schema Contracts',
    'Live App Production Bundle Inspector',
  ],
  'AI & Provider Gateway': [
    'Google Gemini 2.5 Flash',
    'Groq (LLaMA 3.3 70B)',
    'OpenRouter Failover Gateway',
    'DeepSeek & Qwen Routing',
    'Deterministic Fallback Floor',
  ],
  'Database & Security': [
    'Supabase PostgreSQL',
    'Postgres Row-Level Security (RLS)',
    'JWT Authentication & Claims',
    'Candidate vs Recruiter Boundary',
  ],
  'Fintech & Monetization': [
    'Stripe Webhooks (Global Cards)',
    'Bangladesh MFS Engine (bKash/Nagad)',
    '24h Provisional Access Ledger',
    'Admin Verification Console (/admin/billing)',
  ],
};
