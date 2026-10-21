'use client';

/**
 * Post-checkout return notice (M25B — architecture §8).
 *
 * Checkout redirects back with `?checkout=success`, but the webhook that grants
 * the plan is a separate delivery — it can land a second or two later. So this
 * banner re-checks entitlements for a few seconds instead of claiming an upgrade
 * that has not happened yet, and disappears on its own once the tier lifts.
 * Nothing here decides anything: it only re-reads the server's verdict.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { useEntitlements } from '@/hooks/useEntitlements';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 8; // ~16s, then we stop nagging and leave the meter to speak

function CheckoutNoticeInner() {
  const params = useSearchParams();
  const checkout = params.get('checkout');
  const { entitlements, refresh } = useEntitlements();
  const [polls, setPolls] = useState(0);

  const waiting = checkout === 'success' && entitlements.tier !== 'pro' && entitlements.tier !== 'team';

  useEffect(() => {
    if (checkout !== 'success') return;
    // Clear the query param so a later refresh does not re-arm the banner.
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    window.history.replaceState({}, '', url.toString());
  }, [checkout]);

  useEffect(() => {
    if (!waiting || polls >= MAX_POLLS) return;
    const id = setTimeout(() => {
      void refresh();
      setPolls((n) => n + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [waiting, polls, refresh]);

  if (checkout !== 'success') return null;

  const lifted = entitlements.tier === 'pro' || entitlements.tier === 'team';
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[11px] ${
        lifted
          ? 'border-signal/40 bg-signal/10 text-signal'
          : 'border-edge bg-card text-muted'
      }`}
    >
      <Icon.Check className="h-3.5 w-3.5" />
      {lifted
        ? 'Payment received — your Pro limits are live. Nothing you built changed.'
        : 'Payment received. Confirming your plan… your meter updates the moment it lands.'}
    </div>
  );
}

export function CheckoutNotice() {
  return (
    <React.Suspense fallback={null}>
      <CheckoutNoticeInner />
    </React.Suspense>
  );
}