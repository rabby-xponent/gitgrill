'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/icons';
import { PLANS, PlanId, submitMfsPayment, fetchMfsConfig, MfsAccountConfig, MfsProvider } from '@/lib/billing';
import { useSession } from '@/components/SessionProvider';

interface BkashNagadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: PlanId;
  onSuccess?: () => void;
}

export function BkashNagadModal({
  isOpen,
  onClose,
  defaultPlan = 'pro_monthly',
  onSuccess,
}: BkashNagadModalProps) {
  const { user } = useSession();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(defaultPlan);
  const [provider, setProvider] = useState<MfsProvider>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<MfsAccountConfig>({
    bkash: { number: '01711-000000', type: 'personal', note: 'Send Money অপশন ব্যবহার করুন', isActive: true },
    nagad: { number: '01811-000000', type: 'personal', note: 'Send Money অপশন ব্যবহার করুন', isActive: true },
    noticeMessage: 'বিকাশ অথবা নগদ দিয়ে পেমেন্ট করার পর ট্রানজেকশন আইডি (TrxID) সাবমিট করুন।',
  });

  useEffect(() => {
    if (isOpen) {
      fetchMfsConfig().then((res) => {
        if (res) {
          setAccounts(res);
          // If bkash is inactive but nagad is active, default to nagad
          if (!res.bkash?.isActive && res.nagad?.isActive) {
            setProvider('nagad');
          } else if (res.bkash?.isActive) {
            setProvider('bkash');
          }
        }
      });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', onKey);
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const planInfo = PLANS[selectedPlan];
  const isBkashActive = accounts.bkash?.isActive !== false && Boolean(accounts.bkash?.number);
  const isNagadActive = accounts.nagad?.isActive !== false && Boolean(accounts.nagad?.number);
  const activeAccount = (provider === 'nagad' && isNagadActive) ? accounts.nagad : accounts.bkash;

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(activeAccount.number.replace(/[^\d]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!senderNumber.trim() || !trxId.trim()) {
      setError('Please provide both your mobile number and Transaction ID (TrxID).');
      return;
    }

    setLoading(true);
    try {
      const res = await submitMfsPayment({
        provider,
        senderNumber: senderNumber.trim(),
        trxId: trxId.trim(),
        planId: selectedPlan,
        userHandle: user?.handle || undefined,
        userEmail: user?.email || undefined,
      });

      setSuccessResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please verify your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fade-up relative w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-pop text-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row with Title & Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ea580c]/30 bg-[#ea580c]/10 text-[#ea580c] font-mono font-bold text-xs">
              ৳
            </span>
            <div>
              <h2 className="text-base font-bold font-sans tracking-tight text-content">
                bKash & Nagad Payment
              </h2>
              <p className="font-mono text-[11px] text-muted">
                Instant activation for Bangladeshi developers & teams
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

        {successResult ? (
          /* Success Screen */
          <div className="text-center py-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Icon.Check className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-xl font-bold font-sans text-emerald-600 dark:text-emerald-400">
              Payment Submitted Successfully
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed max-w-sm mx-auto">
              {successResult.message}
            </p>
            <div className="mt-6 rounded-xl border border-edge bg-well p-4 text-left font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Transaction ID:</span>
                <span className="font-bold text-[#ea580c]">{successResult.record?.trxId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Plan:</span>
                <span className="text-content font-medium">{planInfo.label} ({planInfo.displayBdt})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Status:</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Verification Pending (24h provisional access active)</span>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                window.location.reload();
              }}
              className="mt-6 w-full rounded-xl bg-[#ea580c] hover:bg-[#c2410c] py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition-all shadow-md"
            >
              Go to Dashboard →
            </button>
          </div>
        ) : (
          /* Payment Form */
          <div className="mt-4">
            <p className="text-xs text-muted leading-relaxed">
              Upgrade to Pro directly via bKash or Nagad. Instant 24-hour provisional access is activated immediately.
            </p>

            {/* Plan selector */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPlan('pro_monthly')}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  selectedPlan === 'pro_monthly'
                    ? 'border-[#ea580c] bg-[#ea580c]/10 shadow-xs'
                    : 'border-edge bg-well hover:border-edge/80'
                }`}
              >
                <div className="flex items-center justify-between min-h-[20px]">
                  <span className="font-mono text-xs font-semibold text-muted">Monthly Pro</span>
                </div>
                <div className="mt-1 font-sans text-lg font-extrabold text-content">
                  ৳399 <span className="text-xs font-normal text-muted">/mo</span>
                </div>
                <div className="text-[11px] text-muted font-mono mt-0.5">Deep code audit & drills</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlan('pro_annual')}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  selectedPlan === 'pro_annual'
                    ? 'border-[#ea580c] bg-[#ea580c]/10 shadow-xs'
                    : 'border-edge bg-well hover:border-edge/80'
                }`}
              >
                <div className="flex items-center justify-between min-h-[20px] gap-1">
                  <span className="font-mono text-xs font-semibold text-muted">Annual Pro</span>
                  <span className="rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Save 27%
                  </span>
                </div>
                <div className="mt-1 font-sans text-lg font-extrabold text-content">
                  ৳3,490 <span className="text-xs font-normal text-muted">/yr</span>
                </div>
                <div className="text-[11px] text-muted font-mono mt-0.5">1 year unlimited access</div>
              </button>
            </div>

            {/* Step 1: Send Money Box */}
            <div className="mt-4 rounded-xl border border-edge bg-well/70 p-4">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-content flex items-center justify-between">
                <span>1. {activeAccount.type === 'merchant' ? 'Make Payment' : 'Send Money'} ({planInfo.displayBdt})</span>
                {/* Method selector pills */}
                <div className="flex gap-1.5">
                  {isBkashActive && (
                    <button
                      type="button"
                      onClick={() => setProvider('bkash')}
                      className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                        provider === 'bkash'
                          ? 'bg-[#e2136e] text-white shadow-xs'
                          : 'border border-edge bg-card text-muted hover:text-content'
                      }`}
                    >
                      bKash
                    </button>
                  )}
                  {isNagadActive && (
                    <button
                      type="button"
                      onClick={() => setProvider('nagad')}
                      className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                        provider === 'nagad'
                          ? 'bg-[#f7941d] text-white shadow-xs'
                          : 'border border-edge bg-card text-muted hover:text-content'
                      }`}
                    >
                      Nagad
                    </button>
                  )}
                </div>
              </div>

              {/* Number and copy button Well */}
              <div className="mt-3 flex items-center justify-between rounded-lg border border-edge bg-card px-4 py-3 shadow-xs">
                <div>
                  <div className="text-[11px] text-muted font-mono uppercase tracking-wider">
                    {provider.toUpperCase()} ({activeAccount.type}) Number
                  </div>
                  <div className="text-lg font-bold font-mono text-content tracking-wider mt-0.5 select-all">
                    {activeAccount.number}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="rounded-lg border border-edge bg-well hover:bg-card px-3 py-1.5 font-mono text-xs font-medium text-content transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Icon.Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Icon.Copy className="h-3.5 w-3.5 text-muted" />
                      <span>Copy Number</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2 text-[11px] text-muted leading-normal">
                Use <strong>Send Money</strong> in your {provider.toUpperCase()} app. Enter your GitHub username in the reference.
              </div>
            </div>

            {/* Step 2: Form submission */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-content">
                2. Enter Transaction Details
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-mono text-muted mb-1">
                    Sender Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="017XXXXXXXX"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    className="w-full rounded-lg border border-edge bg-well px-3 py-2 font-mono text-xs text-content placeholder:text-muted/60 focus:border-[#ea580c] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-muted mb-1">
                    Transaction ID (TrxID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="BJC7A98DF2"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    className="w-full rounded-lg border border-edge bg-well px-3 py-2 font-mono text-xs text-content uppercase placeholder:text-muted/60 focus:border-[#ea580c] focus:outline-hidden"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300 font-mono">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#ea580c] hover:bg-[#c2410c] py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition-all shadow-md disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Icon.Spinner className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Submit & Activate Pro →</span>
                )}
              </button>

              <div className="text-[11px] text-center text-muted font-mono">
                Immediate 24-hour provisional access is activated upon submission while verification completes.
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
