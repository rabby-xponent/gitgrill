'use client';

import React, { useState, useEffect, Suspense } from 'react';
import DefenseHub from '@/components/DefenseHub';
import { CheckoutNotice } from '@/components/CheckoutNotice';
import { getTargetRoles, syncDefenseCards, DefenseCard } from '@/lib/target-roles';

function DefenseContent() {
  const [defenseCards, setDefenseCards] = useState<DefenseCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const roles = getTargetRoles();
      setDefenseCards(syncDefenseCards(roles));
    } catch {
      setDefenseCards([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:pt-8 sm:px-6">
      <CheckoutNotice />
      {loaded ? (
        <DefenseHub cards={defenseCards} />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center font-mono text-sm text-muted">
          Loading Interview Defense Cards…
        </div>
      )}
    </div>
  );
}

export default function DeveloperDefensePage() {
  return (
    <div className="pb-24">
      <Suspense fallback={
        <div className="flex min-h-[50vh] items-center justify-center font-mono text-sm text-muted">
          Loading Defense Hub…
        </div>
      }>
        <DefenseContent />
      </Suspense>
    </div>
  );
}
