/**
 * Plan catalogue (Pure Bangladesh MFS & BDT Pricing).
 *
 * Companion to `config/tiers.ts`: the registry says what each tier can do, this
 * says what each plan costs in Bangladeshi Taka (BDT) and what cadence it follows.
 *
 * Dependency-free on purpose: the browser imports this through
 * `@backend/config/plans` for upgrade copy, exactly like the tier registry.
 */

import { Tier } from './tiers';

export type PlanId = 'pro_monthly' | 'pro_annual' | 'team_monthly' | 'team_annual';

export interface PlanDefinition {
  id: PlanId;
  tier: Tier;
  label: string;
  /** Shown to the user in the upgrade modal. Never a computed string. */
  display: string;
  /** Display string for Bangladeshi Taka (BDT) */
  displayBdt: string;
  /** Amount in BDT for manual bKash/Nagad transactions */
  bdtAmount: number;
  /** Longer marketing line, e.g. "billed monthly, cancel anytime". */
  cadence: string;
  /** Bengali cadence string */
  cadenceBn: string;
  /** Per-seat plans bill `quantity = seats`; individual plans ignore quantity. */
  perSeat: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  pro_monthly: {
    id: 'pro_monthly',
    tier: 'pro',
    label: 'Developer Pro — Monthly',
    display: '৳399/mo',
    displayBdt: '৳399/mo',
    bdtAmount: 399,
    cadence: 'Billed monthly via bKash / Nagad.',
    cadenceBn: 'মাসিক বিলিং, যেকোনো সময় বাতিলযোগ্য।',
    perSeat: false,
  },
  pro_annual: {
    id: 'pro_annual',
    tier: 'pro',
    label: 'Developer Pro — Annual',
    display: '৳3,490/yr',
    displayBdt: '৳3,490/yr',
    bdtAmount: 3490,
    cadence: 'Two months free versus monthly.',
    cadenceBn: 'বাৎসরিক বিলিং — প্রায় ২৭% সাশ্রয়ী।',
    perSeat: false,
  },
  team_monthly: {
    id: 'team_monthly',
    tier: 'team',
    label: 'Team Recruiter — Monthly',
    display: '৳1,999/mo',
    displayBdt: '৳1,999/mo',
    bdtAmount: 1999,
    cadence: 'Per seat, billed monthly.',
    cadenceBn: 'টিম অ্যাক্সেস ও আনলিমিটেড স্ক্রিনিং।',
    perSeat: true,
  },
  team_annual: {
    id: 'team_annual',
    tier: 'team',
    label: 'Team Recruiter — Annual',
    display: '৳18,990/yr',
    displayBdt: '৳18,990/yr',
    bdtAmount: 18990,
    cadence: 'Per seat, two months free.',
    cadenceBn: 'সম্পূর্ণ টিম ও রিক্রুটিং স্যুট (বাৎসরিক)।',
    perSeat: true,
  },
};

/** Default plan shown by a generic upgrade CTA. */
export const DEFAULT_PLAN: PlanId = 'pro_monthly';

export const ALL_PLANS: PlanId[] = Object.keys(PLANS) as PlanId[];