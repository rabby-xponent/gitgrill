'use client';

import React, { useState } from 'react';
import { RecruiterAccount, saveRecruiterAccount } from '@/lib/recruiter-auth';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/admin';
import { Icon } from '@/components/icons';
import { Switch } from '@/components/ui';

interface RecruiterAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: RecruiterAccount;
  onUpdate: (updated: RecruiterAccount) => void;
}

export default function RecruiterAccountModal({
  isOpen,
  onClose,
  account,
  onUpdate,
}: RecruiterAccountModalProps) {
  const { user } = useSession();
  const isSuperAdmin = isAdmin(user);
  const [name, setName] = useState(account.name);
  const [title, setTitle] = useState(account.title);
  const [company, setCompany] = useState(account.company);
  const [email, setEmail] = useState(account.email);
  const [department, setDepartment] = useState(account.department);
  const [defaultFit, setDefaultFit] = useState(account.preferences.defaultMinimumFit);
  const [allowPrivate, setAllowPrivate] = useState(account.preferences.allowPrivateRepos);
  const [autoShortlist, setAutoShortlist] = useState(account.preferences.autoShortlistTopMatches);
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveRecruiterAccount({
      name: name.trim(),
      title: title.trim(),
      company: company.trim(),
      email: email.trim(),
      department: department.trim(),
      preferences: {
        ...account.preferences,
        defaultMinimumFit: defaultFit,
        allowPrivateRepos: allowPrivate,
        autoShortlistTopMatches: autoShortlist,
      },
    });
    onUpdate(updated);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 800);
  };

  const inputClass =
    'w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/15 placeholder:text-muted/60';
  const labelClass =
    'font-mono text-[11px] uppercase tracking-wider text-muted font-bold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-edge bg-card text-content shadow-pop overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge bg-well px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-signal/30 bg-signal/10 flex items-center justify-center overflow-hidden">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt={account.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-sm font-bold text-signal">
                  {name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-signal font-bold">
                  Recruiter Identity & Workspace
                </span>
                <span className="rounded-full border border-signal/25 bg-signal/10 px-2 py-0.5 font-mono text-[9px] font-bold text-signal uppercase">
                  {isSuperAdmin ? 'Super Admin · Unlimited' : account.planTier}
                </span>
              </div>
              <h2 className="font-mono text-sm font-bold text-content">
                {name || 'Recruiter Profile'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-card text-muted transition-colors hover:text-content"
          >
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 thin-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className={labelClass}>Your Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className={labelClass}>Job Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Technical Recruiter"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Company / Organization</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Talent Partners"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Team / Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Engineering Talent Acquisition"
              className={inputClass}
            />
          </div>

          {/* Hiring Guardrails Defaults */}
          <div className="pt-2 border-t border-edge space-y-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-signal font-bold">
              Default Screening Guardrails
            </span>

            <div className="rounded-xl border border-edge bg-well p-3 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted">Default Minimum Fit Threshold:</span>
                <span className="font-bold text-signal">{defaultFit}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={defaultFit}
                onChange={(e) => setDefaultFit(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-well p-2.5 transition-colors hover:border-signal/40">
                <div className="font-mono text-xs min-w-0">
                  <span className="text-content font-semibold block">Private Repo Bias Shield</span>
                  <span className="text-muted text-[10px]">
                    Never penalize enterprise engineers who contribute code to private corporate orgs.
                  </span>
                </div>
                <Switch
                  checked={allowPrivate}
                  onChange={setAllowPrivate}
                  ariaLabel="Private repo bias shield"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-well p-2.5 transition-colors hover:border-signal/40">
                <div className="font-mono text-xs min-w-0">
                  <span className="text-content font-semibold block">Auto-Shortlist Top Matches</span>
                  <span className="text-muted text-[10px]">
                    Automatically advance candidates scoring ≥ 85% to Phone Screen stage.
                  </span>
                </div>
                <Switch
                  checked={autoShortlist}
                  onChange={setAutoShortlist}
                  ariaLabel="Auto-shortlist top matches"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-edge">
            <span className="font-mono text-[10px] text-muted">
              Preferences are saved to your browser session.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-edge bg-card px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-signal/50 hover:text-content outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-signal px-4 py-1.5 font-mono text-xs font-bold text-white shadow-xs transition-colors hover:bg-signal/90 outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
              >
                {savedToast ? 'Saved' : 'Save Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
