'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { JDResumeMatchmaker } from '@/components/JDResumeMatchmaker';
import { CheckoutNotice } from '@/components/CheckoutNotice';

function MatchmakerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoleId = searchParams.get('roleId') || undefined;
  const initialResumeId = searchParams.get('resumeId') || undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:pt-8 sm:px-6">
      <CheckoutNotice />
      <JDResumeMatchmaker
        initialRoleId={initialRoleId}
        initialResumeId={initialResumeId}
        onNavigateToRole={(rId) => {
          router.push(`/developer?roleId=${encodeURIComponent(rId)}`);
        }}
        onNavigateToResume={(resId) => {
          router.push(`/developer/resumes?resumeId=${encodeURIComponent(resId)}`);
        }}
      />
    </div>
  );
}

export default function DeveloperMatchmakerPage() {
  return (
    <div className="pb-24">
      <Suspense fallback={
        <div className="flex min-h-[50vh] items-center justify-center font-mono text-sm text-muted">
          Loading Matchmaker Studio…
        </div>
      }>
        <MatchmakerContent />
      </Suspense>
    </div>
  );
}
