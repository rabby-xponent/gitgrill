'use client';

/**
 * Quota meter (/developer header — architecture §7, first row).
 *
 * Shows what is left, honestly: signed-in users get the live ledger count from
 * `GET /api/entitlements`, and the meter turns to the signal color at 1
 * remaining so the wall is never a surprise. Anonymous visitors see the demo
 * state instead of a fake number — the demo is per profile, not per month.
 *
 * Never hides existing work: this is a counter, not a gate.
 */

import React from 'react';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/SessionProvider';
import { useEntitlements } from '@/hooks/useEntitlements';
import { capabilityOf } from '@/lib/entitlements';
import { isAdmin } from '@/lib/admin';

export function QuotaMeter() {
  const { user, loading, openSignIn } = useSession();
  const { entitlements } = useEntitlements();
  const isSuperAdmin = isAdmin(user);

  if (loading) {
    return <div className="h-[30px] w-40 animate-pulse rounded-xl border border-edge bg-well" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        title="Sign in for free audits per rolling 30 days"
        className="hidden items-center gap-1.5 rounded-xl border border-edge bg-card px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-signal/50 hover:text-signal outline-none focus-visible:ring-2 focus-visible:ring-signal/40 lg:flex"
      >
        <Icon.Zap className="h-3.5 w-3.5" />
        <span>demo · 1 audit per profile</span>
      </button>
    );
  }

  if (isSuperAdmin) {
    return (
      <button
        type="button"
        onClick={() => {
          const hud = document.getElementById('career-quota-hud');
          if (hud) hud.scrollIntoView({ behavior: 'smooth' });
        }}
        title="Super Admin: Uncapped Access to All 7 Capabilities (Click to view HUD)"
        className="hidden items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 font-mono text-[11px] text-purple-300 transition-colors hover:border-purple-400 hover:bg-purple-500/20 lg:flex outline-none cursor-pointer"
      >
        <Icon.Shield className="h-3.5 w-3.5 text-purple-400" />
        <span className="font-bold">Super Admin (∞ Quota)</span>
      </button>
    );
  }

  const audit = capabilityOf(entitlements, 'audit.run');
  const unlimited = audit.limit === 'unlimited';
  const remaining = audit.remaining ?? 0;
  const total = typeof audit.limit === 'number' ? audit.limit : 0;
  const low = !unlimited && remaining <= 1;
  const exhausted = !unlimited && !audit.allowed;
  const barWidth = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 100;
  const resetLabel = audit.resetAt
    ? new Date(audit.resetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      type="button"
      onClick={() => {
        const hud = document.getElementById('career-quota-hud');
        if (hud) hud.scrollIntoView({ behavior: 'smooth' });
      }}
      className={`hidden cursor-pointer flex-col justify-center rounded-xl border px-3 py-1 transition-all lg:flex bg-card text-left hover:scale-[1.01] ${
        exhausted
          ? 'border-signal/50 bg-gradient-to-r from-signal/15 to-signal/5'
          : low
            ? 'border-signal/40 bg-gradient-to-r from-signal/10 to-signal/5'
            : 'border-edge hover:border-signal/40'
      }`}
      title={exhausted ? audit.reason || undefined : `${audit.label} · Click to view Quota HUD`}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] leading-tight">
        <Icon.Zap className={`h-3 w-3 ${exhausted || low ? 'text-signal' : 'text-muted'}`} />
        {unlimited ? (
          <span className="font-semibold text-content">unlimited audits</span>
        ) : (
          <span className={low ? 'font-semibold text-signal' : 'font-semibold text-content'}>
            {remaining} of {total} audits left
          </span>
        )}
        {resetLabel && !unlimited && <span className="text-muted">· resets {resetLabel}</span>}
      </div>
      {!unlimited && (
        <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-edge">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              exhausted ? 'bg-signal/60' : 'bg-signal'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </button>
  );
}