'use client';

import React, { Suspense } from 'react';
import { ResumeVault } from '@/components/ResumeVault';
import { CheckoutNotice } from '@/components/CheckoutNotice';

export default function DeveloperResumesPage() {
  return (
    <div className="pb-24">
      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:pt-8 sm:px-6">
        <Suspense fallback={
          <div className="flex min-h-[50vh] items-center justify-center font-mono text-sm text-muted">
            Loading Resume Vault Studio…
          </div>
        }>
          <CheckoutNotice />
          <ResumeVault />
        </Suspense>
      </div>
    </div>
  );
}
