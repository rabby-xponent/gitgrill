'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/icons';
import { TargetRole, saveTargetRole, setActiveTargetRoleId, getTargetRoles } from '@/lib/target-roles';
import { FormField, TextInput, TextArea } from '@/components/ui';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/admin';

interface NewTargetRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (role: TargetRole) => void;
}

export default function NewTargetRoleModal({ isOpen, onClose, onCreate }: NewTargetRoleModalProps) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawJdText, setRawJdText] = useState('');

  const { entitlements } = useEntitlements();
  const { user } = useSession();
  const isSuperAdmin = isAdmin(user);

  if (!isOpen) return null;

  const existingRoles = getTargetRoles();
  const roleVerdict = entitlements.capabilities['target_role.create'];
  const roleLimit = isSuperAdmin ? 'unlimited' : (typeof roleVerdict?.limit === 'number' ? roleVerdict.limit : 5);
  const isRoleAtLimit = !isSuperAdmin && typeof roleLimit === 'number' && existingRoles.length >= roleLimit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRoleAtLimit) return;
    if (!title.trim() || !rawJdText.trim()) return;

    const role: TargetRole = {
      id: `target_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      company: company.trim() || 'Target Company',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawJdText: rawJdText.trim(),
      sourceUrl: sourceUrl.trim() || undefined,
      status: 'researching',
      notes: '',
      auditHistory: [],
    };

    const saved = saveTargetRole(role);
    setActiveTargetRoleId(saved.id);
    onCreate(saved);

    setTitle('');
    setCompany('');
    setSourceUrl('');
    setRawJdText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-edge bg-card text-content p-6 shadow-pop">
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-well text-muted">
              <Icon.Target className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-content">
                  Add Target Role
                </h2>
                <span className="font-mono text-[10px] text-muted rounded bg-well px-1.5 py-0.2 border border-edge">
                  {existingRoles.length} / {isSuperAdmin ? '∞' : roleLimit} roles
                </span>
              </div>
              <p className="text-[11px] text-muted font-sans mt-0.5">
                Paste the job description you&apos;re about to apply for — audits run against it.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-well hover:text-content cursor-pointer"
          >
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {isRoleAtLimit ? (
          <div className="my-6 space-y-4 text-center p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 mx-auto">
              <Icon.Lock className="h-5 w-5" />
            </div>
            <h3 className="font-sans font-bold text-sm text-content">
              Target Roles Quota Reached ({existingRoles.length} / {roleLimit})
            </h3>
            <p className="font-mono text-xs text-muted max-w-md mx-auto leading-relaxed">
              Your current tier allows up to {roleLimit} active target roles and job descriptions. Upgrade to Pro for 50 target roles.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-edge px-4 py-2 font-mono text-xs text-muted hover:text-content cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex-1 space-y-4 overflow-y-auto thin-scroll pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Role Title *" hint="Job designation">
                <TextInput
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </FormField>
              <FormField label="Company" hint="Employer / organization">
                <TextInput
                  placeholder="e.g. Cefalo"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Job Posting URL" hint="Optional reference link">
              <TextInput
                type="url"
                placeholder="https://jobs.example.com/role/123"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                mono
              />
            </FormField>

            <FormField
              label="Job Description Text *"
              hint="Full role responsibilities, tech stack, and qualifications"
            >
              <TextArea
                required
                rows={7}
                placeholder="Paste the complete job description: responsibilities, requirements, stack…"
                value={rawJdText}
                onChange={(e) => setRawJdText(e.target.value)}
                mono
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-edge">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-edge bg-card px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-signal/50 hover:text-content outline-none focus-visible:ring-2 focus-visible:ring-signal/40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-signal px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-signal/90 outline-none focus-visible:ring-2 focus-visible:ring-signal/40 cursor-pointer"
              >
                Add Target Role
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
