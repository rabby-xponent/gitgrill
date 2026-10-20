'use client';

import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import {
  DefenseCard,
  dueDefenseCards,
  gradeDefenseCard,
} from '@/lib/target-roles';
import { useCapabilityLock } from '@/components/FeatureLock';
import { useEntitlements } from '@/hooks/useEntitlements';

const CONFIDENCE_META: Record<
  DefenseCard['confidence'],
  { label: string; className: string }
> = {
  never_seen: {
    label: 'Never seen',
    className: 'border-edge bg-well text-muted',
  },
  shaky: {
    label: 'Shaky',
    className: 'border-signal/35 bg-signal/10 text-signal',
  },
  solid: {
    label: 'Solid',
    className: 'border-signal/40 bg-signal/15 text-signal font-bold',
  },
};

function formatNextReview(card: DefenseCard): string {
  if (card.confidence === 'never_seen') return 'not practiced';
  if (card.nextReviewAt === 0) return 'daily until solid';
  const days = Math.ceil((card.nextReviewAt - Date.now()) / (24 * 3600 * 1000));
  return days <= 0 ? 'due now' : `due in ${days}d`;
}

export default function DefenseHub({ cards }: { cards: DefenseCard[] }) {
  const [localCards, setLocalCards] = useState<DefenseCard[]>(cards);
  const [practiceIndex, setPracticeIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // `practice.full` is Pro (view-only on Free): the deck and every past review
  // stay visible and readable — only grading/practice is gated (§7).
  const { entitlements } = useEntitlements();
  const practiceLock = useCapabilityLock(entitlements, 'practice.full');
  const practiceLocked = practiceLock.locked;

  const due = useMemo(() => dueDefenseCards(localCards), [localCards]);
  const solidCount = localCards.filter((c) => c.confidence === 'solid').length;

  const practicing = practiceIndex !== null && due[practiceIndex];

  const handleGrade = (confidence: DefenseCard['confidence']) => {
    if (!practicing) return;
    const updated = gradeDefenseCard(practicing.id, confidence);
    setLocalCards(updated);
    setRevealed(false);
    setPracticeIndex((i) =>
      i === null ? null : i + 1 >= due.length ? null : i + 1
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Practice mode: one card at a time, rubric hidden until revealed  */
  /* ---------------------------------------------------------------- */
  if (practicing) {
    return (
      <div className="rounded-2xl border border-signal/40 bg-card p-6 shadow-card sm:p-7">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
            <Icon.Zap className="h-3.5 w-3.5" />
            Practice {practiceIndex! + 1} of {due.length}
          </span>
          <button
            type="button"
            onClick={() => {
              setPracticeIndex(null);
              setRevealed(false);
            }}
            className="flex items-center gap-1 rounded-lg border border-edge bg-card px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:border-signal/50 hover:text-signal"
          >
            <Icon.X className="h-3 w-3" />
            End session
          </button>
        </div>

        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {practicing.roleTitle}
        </div>

        <blockquote className="mt-4 rounded-xl border border-edge bg-well p-5">
          <p className="font-sans text-base font-semibold leading-relaxed text-content">
            {practicing.question}
          </p>
        </blockquote>

        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-5 w-full rounded-xl bg-signal px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-signal/90 outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
          >
            Answer out loud, then reveal the grading rubric
          </button>
        ) : (
          <div className="mt-5 space-y-3 animate-in">
            <div className="rounded-xl border border-signal/25 bg-signal/[0.06] p-4">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-signal">
                <Icon.Check className="h-3 w-3" />
                What a strong answer covers
              </div>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-content/90">
                {practicing.whatToListenFor || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-well p-4">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-muted">
                <Icon.Alert className="h-3 w-3" />
                Red flag to avoid
              </div>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-content/85">
                {practicing.redFlagSignal || '—'}
              </p>
            </div>

            <div className="pt-1">
              <div className="text-center font-mono text-[10px] uppercase tracking-wider text-muted">
                Grade yourself honestly — it schedules your next rep
              </div>
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleGrade('never_seen')}
                  className="rounded-xl border border-edge bg-well px-3 py-2.5 font-mono text-xs font-semibold text-muted transition-colors hover:border-signal/50 hover:text-content text-center cursor-pointer"
                >
                  Didn&apos;t know it
                </button>
                <button
                  type="button"
                  onClick={() => handleGrade('shaky')}
                  className="rounded-xl border border-signal/35 bg-signal/10 px-3 py-2.5 font-mono text-xs font-semibold text-signal transition-colors hover:bg-signal/20 text-center cursor-pointer"
                >
                  Shaky
                </button>
                <button
                  type="button"
                  onClick={() => handleGrade('solid')}
                  className="rounded-xl border border-signal/40 bg-signal px-3 py-2.5 font-mono text-xs font-bold text-white transition-colors hover:bg-signal/90 text-center cursor-pointer"
                >
                  Solid
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Idle state: queue summary + start button + full bank list        */
  /* ---------------------------------------------------------------- */
  return (
    <div className="rounded-2xl border border-edge bg-card p-4 sm:p-6 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge pb-4">
        <div>
          <h2 className="font-mono text-base font-bold text-content">
            Interview Defense Hub
          </h2>
          <p className="mt-0.5 font-sans text-xs text-muted">
            Every question the agent flagged for your target roles, accumulated into one practice deck.
          </p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <div className="text-right font-mono text-[10px] text-muted">
            <div>
              <span className="text-content font-bold">{due.length}</span> due
            </div>
            <div>
              <span className="text-signal font-bold">{solidCount}</span> solid
            </div>
          </div>
          <button
            type="button"
            disabled={due.length === 0}
            title={practiceLocked ? practiceLock.verdict.reason || undefined : undefined}
            onClick={() => {
              if (practiceLocked) {
                practiceLock.onRequest();
                return;
              }
              setPracticeIndex(0);
              setRevealed(false);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal/40 cursor-pointer ${
              due.length > 0 && !practiceLocked
                ? 'bg-signal text-white shadow-xs hover:bg-signal/90'
                : 'cursor-not-allowed border border-edge bg-well text-muted/60'
            }`}
          >
            {practiceLocked ? (
              <Icon.Lock className="h-3.5 w-3.5" />
            ) : (
              <Icon.Zap className="h-3.5 w-3.5" />
            )}
            {due.length > 0 ? `Practice (${due.length})` : 'All caught up'}
            {practiceLocked && practiceLock.lock}
          </button>
        </div>
      </div>

      {localCards.length === 0 ? (
        <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
          Run pre-flight audits against your target roles — the agent&apos;s phone-screen questions
          will collect here automatically so you can drill them before the real call.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {localCards.map((card) => {
            const meta = CONFIDENCE_META[card.confidence];
            const isDue = due.some((d) => d.id === card.id);
            return (
              <li
                key={card.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-edge bg-well p-3"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted">
                    {card.roleTitle}
                  </div>
                  <p className="mt-0.5 truncate font-sans text-xs font-medium text-content">
                    {card.question}
                  </p>
                  <div className="mt-1 font-mono text-[9px] text-muted/80">
                    {formatNextReview(card)} · {card.reviews} rep{card.reviews === 1 ? '' : 's'}
                  </div>
                </div>
                <span
                  className={`flex-none rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${meta.className} ${
                    isDue && card.confidence !== 'never_seen' ? 'ring-1 ring-signal/40' : ''
                  }`}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
