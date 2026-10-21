'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';
import { QuotaMeter } from '@/components/QuotaMeter';
import { AccountMenu } from '@/components/AccountMenu';
import { ThemeToggle } from '@/lib/theme';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/admin';

interface DeveloperHeaderProps {
  onOpenMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DeveloperHeader({
  onOpenMobile,
  isCollapsed = false,
  onToggleCollapse,
}: DeveloperHeaderProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const isSuperAdmin = isAdmin(user);

  const getBreadcrumb = () => {
    switch (pathname) {
      case '/developer/portfolio':
        return { section: 'Living Portfolio', title: 'Master SSOT Studio' };
      case '/developer/resumes':
        return { section: 'Resume Vault', title: 'AI Diagnostics & Variants' };
      case '/developer/matchmaker':
        return { section: 'Matchmaker Studio', title: 'JD ↔ Resume Benchmarking' };
      case '/developer/defense':
        return { section: 'Defense Hub', title: 'Interview Probe Rehearsals' };
      case '/developer/profile':
        return { section: 'Account', title: 'Account & Settings' };
      case '/developer':
      default:
        return { section: 'CareerOS', title: 'Target Roles & Pipeline' };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-edge bg-card/85 backdrop-blur-md px-4 sm:px-6 transition-colors">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Trigger */}
        <button
          onClick={onOpenMobile}
          className="flex lg:hidden h-9 w-9 items-center justify-center rounded-xl border border-edge bg-well text-muted hover:text-content hover:border-signal/50 transition-colors"
          aria-label="Open sidebar navigation"
        >
          <Icon.Menu className="h-4 w-4" />
        </button>

        {/* Desktop Sidebar Toggle (only visible when sidebar is collapsed) */}
        {isCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-well text-muted hover:border-signal/50 hover:text-signal transition-colors cursor-pointer"
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar"
          >
            <Icon.PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Clean Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/developer"
            className="hidden sm:inline font-mono text-xs text-muted hover:text-signal transition-colors truncate"
          >
            CareerOS
          </Link>
          <span className="hidden sm:inline text-edge select-none">/</span>
          <span className="font-mono text-xs font-semibold text-content truncate">
            {breadcrumb.title}
          </span>
        </div>
      </div>

      {/* Right Utilities */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {isSuperAdmin && (
          <Link
            href="/recruiter"
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-[#ea580c]/30 bg-[#ea580c]/10 px-2.5 py-1 font-mono text-xs font-semibold text-[#ea580c] hover:bg-[#ea580c]/20 transition-colors shadow-2xs"
            title="Super Admin: Access RecruiterOS Command Center"
          >
            <Icon.Briefcase className="h-3.5 w-3.5" />
            <span>RecruiterOS</span>
          </Link>
        )}
        <QuotaMeter />
        <AccountMenu workspace="developer" />
        <ThemeToggle />
        <Link
          href="/"
          className="hidden sm:inline-flex items-center rounded-lg border border-edge bg-card px-2.5 py-1.5 font-mono text-xs text-muted shadow-xs transition-colors hover:border-signal/50 hover:text-signal"
        >
          ← Home
        </Link>
      </div>
    </header>
  );
}
