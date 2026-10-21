'use client';

/**
 * Upgrade modal (architecture §7 — "Modal: Free (wait for reset / upgrade to
 * Pro)").
 *
 * Rules this component exists to honor:
 * - It never blocks access to data the user already owns. A locked capability is
 *   about doing something *new*, and the copy says so.
 * - It reads what Pro includes from the tier registry and what it costs from the
 *   plan catalogue, so the pitch can never drift from the product or the price.
 * - When billing is not configured it says so. No fake payment step, no dead
 *   button: "Keep working on Free" is always available.
 */

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Capability, ruleFor } from '@backend/config/tiers';
import type { EntitlementEntry } from '@/lib/entitlements';
import { useSession } from '@/components/SessionProvider';
import { PLANS, PlanId } from '@/lib/billing';
import { BkashNagadModal } from '@/components/BkashNagadModal';

/** What Pro adds over Free, read straight from the registry. */
function proHighlights(capability: Capability | null): string[] {
  const keys: Capability[] = capability
    ? [capability]
    : ['audit.run', 'target_role.create', 'proof.publish', 'practice.full'];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    const rule = ruleFor('pro', key);
    if (rule && !seen.has(rule.label)) {
      seen.add(rule.label);
      out.push(rule.label);
    }
  }
  return out;
}

/** Individual plans only — Team seats are a sales conversation, not this wall. */
const UPGRADE_PLANS: PlanId[] = ['pro_monthly', 'pro_annual'];

export function UpgradeModal({
  verdict,
  capability = null,
  onClose,
}: {
  verdict: EntitlementEntry;
  capability?: Capability | null;
  onClose: () => void;
}) {
  const { user, openSignIn } = useSession();
  const [plan, setPlan] = useState<PlanId>('pro_monthly');
  const [showBkashModal, setShowBkashModal] = useState(false);
  const onPaidTier = verdict.tier === 'pro' || verdict.tier === 'team';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan limit reached"
        onClick={(e) => e.stopPropagation()}
        className="fade-up w-full max-w-md rounded-2xl border border-edge bg-card p-6 shadow-card"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-signal/30 bg-signal/10 text-signal">
              <Icon.Lock className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-content">
                {verdict.tier === 'anonymous' ? 'Demo limit reached' : 'Free plan limit'}
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                {verdict.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-well/50 text-muted transition-colors hover:border-signal/50 hover:bg-well hover:text-signal"
          >
            <Icon.X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-4 font-sans text-sm leading-relaxed text-muted">{verdict.reason}</p>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">
          Pro includes
        </p>
        <ul className="mt-2 space-y-1.5">
          {proHighlights(capability).map((line) => (
            <li key={line} className="flex items-start gap-2 font-sans text-xs text-content">
              <Icon.Check className="mt-0.5 h-3 w-3 flex-none text-signal" />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2.5">
          {!user ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                openSignIn();
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-signal px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-signal/90 active:scale-[0.99]"
            >
              <span>Create your free account</span>
            </button>
          ) : onPaidTier ? (
            <button
              type="button"
              onClick={() => setShowBkashModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-signal px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-signal/90"
            >
              <span>Manage Subscription & Extend Plan</span>
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
                {UPGRADE_PLANS.map((id) => {
                  const option = PLANS[id];
                  const selected = plan === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPlan(id)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-signal/60 bg-signal/10'
                          : 'border-edge bg-well hover:border-signal/30'
                      }`}
                    >
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                        {id === 'pro_monthly' ? 'Monthly' : 'Annual'}
                      </span>
                      <span className="block font-mono text-sm font-bold text-content">
                        {option.display}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted/80">
                {PLANS[plan].cadence}
              </p>
              <button
                type="button"
                onClick={() => setShowBkashModal(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-signal hover:bg-signal/90 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all active:scale-[0.99] cursor-pointer"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-signal text-[10px] font-extrabold">৳</span>
                <span>Upgrade with bKash / Nagad ({PLANS[plan].displayBdt})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-edge px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-signal/50 hover:text-signal"
          >
            Keep working on Free
          </button>
        </div>

        {showBkashModal && (
          <BkashNagadModal
            isOpen={showBkashModal}
            defaultPlan={plan}
            onClose={() => setShowBkashModal(false)}
            onSuccess={() => {
              setShowBkashModal(false);
              onClose();
            }}
          />
        )}

        <p className="mt-4 border-t border-edge pt-3 font-sans text-[11px] leading-relaxed text-muted/80">
          Everything you have already built stays exactly where it is — limits apply to new
          actions, never to work in progress.
        </p>
      </div>
    </div>
  );
}