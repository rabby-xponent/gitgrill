'use client';

import React, { Suspense } from 'react';
import { PortfolioHub } from '@/components/PortfolioHub';
import { CheckoutNotice } from '@/components/CheckoutNotice';

export default function DeveloperPortfolioPage() {
  return (
    <div className="pb-24">
      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:pt-8 sm:px-6">
        <Suspense fallback={
          <div className="flex min-h-[50vh] items-center justify-center font-mono text-sm text-muted">
            Loading Portfolio SSOT Studio…
          </div>
        }>
          <CheckoutNotice />
          <PortfolioHub />
        </Suspense>
      </div>
    </div>
  );
}
