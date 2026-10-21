'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { Icon } from '@/components/icons';
import { QuotaMeter } from '@/components/QuotaMeter';
import { AccountMenu } from '@/components/AccountMenu';
import { ThemeToggle } from '@/lib/theme';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/admin';
import { getTargetRoles } from '@/lib/target-roles';
import { getResumes } from '@/lib/resumes';
import { getPortfolioSSOTLocal, countTotalMasterBullets } from '@/lib/portfolio';

export type DeveloperTabKey = 'roles' | 'portfolio' | 'resumes' | 'matchmaker' | 'defense' | 'profile';

interface DeveloperNavProps {
  activeTab?: DeveloperTabKey;
  subtitle?: string;
  badge?: string;
}

export function DeveloperNav({
  activeTab,
  subtitle = 'Engineering Job Search Command Center',
  badge = 'CareerOS',
}: DeveloperNavProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const isSuperAdmin = isAdmin(user);

  const [rolesCount, setRolesCount] = useState<number>(0);
  const [resumesCount, setResumesCount] = useState<number>(0);
  const [ssotBulletsCount, setSsotBulletsCount] = useState<number>(0);

  useEffect(() => {
    try {
      setRolesCount(getTargetRoles().length);
    } catch {
      setRolesCount(0);
    }
    try {
      setResumesCount(getResumes().length);
    } catch {
      setResumesCount(0);
    }
    try {
      const ssot = getPortfolioSSOTLocal();
      setSsotBulletsCount(countTotalMasterBullets(ssot));
    } catch {
      setSsotBulletsCount(0);
    }
  }, []);

  const navItems = [
    {
      key: 'roles',
      label: 'Target Roles & Pipeline',
      href: '/developer',
      icon: Icon.Target,
      badge: rolesCount > 0 ? String(rolesCount) : undefined,
      isActive: activeTab === 'roles' || pathname === '/developer',
    },
    {
      key: 'portfolio',
      label: 'Living Portfolio (SSOT)',
      href: '/developer/portfolio',
      icon: Icon.Layers,
      badge: ssotBulletsCount > 0 ? `${ssotBulletsCount} bullets` : 'Master',
      isActive: activeTab === 'portfolio' || pathname === '/developer/portfolio',
    },
    {
      key: 'resumes',
      label: 'Resume Vault',
      href: '/developer/resumes',
      icon: Icon.FileText,
      badge: resumesCount > 0 ? `${resumesCount} files` : 'AI Audit',
      isActive: activeTab === 'resumes' || pathname === '/developer/resumes',
    },
    {
      key: 'matchmaker',
      label: 'JD ↔ Resume Matchmaker',
      href: '/developer/matchmaker',
      icon: Icon.Sparkle,
      badge: 'Benchmarking',
      isActive: activeTab === 'matchmaker' || pathname === '/developer/matchmaker',
    },
    {
      key: 'defense',
      label: 'Interview Defense Hub',
      href: '/developer/defense',
      icon: Icon.Shield,
      badge: 'Drills',
      isActive: activeTab === 'defense' || pathname === '/developer/defense',
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-card/90 backdrop-blur-md transition-colors">
      {/* Top Identity & Utilities Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/" className="shrink-0 flex items-center hover:opacity-90 transition-opacity">
            <GitGrillLogo size="sm" />
          </Link>
          <span className="text-edge select-none">/</span>
          <Link href="/developer" className="flex items-center gap-2 min-w-0 hover:opacity-85 transition-opacity">
            <span className="shrink-0 rounded border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-signal">
              {badge}
            </span>
            <span className="hidden sm:inline font-mono text-xs text-muted truncate">
              {subtitle}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {isSuperAdmin && (
            <Link
              href="/recruiter"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-[#ea580c]/30 bg-[#ea580c]/10 px-2.5 sm:px-3 py-1.5 font-mono text-xs font-semibold text-[#ea580c] hover:bg-[#ea580c]/20 transition-colors shadow-2xs"
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
            className="rounded-lg border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-xs text-muted shadow-xs transition-colors hover:border-signal/50 hover:text-signal"
          >
            <span className="hidden xs:inline">← Public Home</span>
            <span className="xs:hidden">← Home</span>
          </Link>
        </div>
      </div>

      {/* Studio Workspaces Navigation Bar */}
      <div className="border-t border-edge/60 bg-well/40 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between overflow-x-auto no-scrollbar py-2 gap-2">
          <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0" aria-label="Developer Workspace Navigation">
            {navItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 sm:px-3.5 py-1.5 font-mono text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                    item.isActive
                      ? 'border border-signal/40 bg-signal/10 text-signal shadow-2xs'
                      : 'border border-transparent text-muted hover:border-edge hover:bg-card hover:text-content'
                  }`}
                >
                  <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] uppercase tracking-wider ${
                        item.isActive
                          ? 'bg-signal/20 text-signal font-bold'
                          : 'bg-edge/70 text-muted'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/developer/profile"
            className={`hidden lg:flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-colors shrink-0 ${
              pathname === '/developer/profile'
                ? 'text-signal bg-signal/10'
                : 'text-muted hover:text-content hover:bg-card'
            }`}
          >
            <Icon.User className="h-3 w-3" />
            <span>Profile & Quotas</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
