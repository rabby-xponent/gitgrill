'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitGrillLogoMark } from '@/components/GitGrillLogo';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/SessionProvider';
import { useEntitlements } from '@/hooks/useEntitlements';
import { isAdmin } from '@/lib/admin';
import { getTargetRoles } from '@/lib/target-roles';
import { getResumes } from '@/lib/resumes';
import { getPortfolioSSOTLocal, countTotalMasterBullets } from '@/lib/portfolio';
import { BkashNagadModal } from '@/components/BkashNagadModal';

export interface DeveloperSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function DeveloperSidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: DeveloperSidebarProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const { entitlements } = useEntitlements();
  const isSuperAdmin = isAdmin(user);

  const [rolesCount, setRolesCount] = useState<number>(0);
  const [resumesCount, setResumesCount] = useState<number>(0);
  const [ssotBulletsCount, setSsotBulletsCount] = useState<number>(0);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

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
  }, [pathname]);

  const studios = [
    {
      title: 'Target Roles & Pipeline',
      shortTitle: 'Roles & JDs',
      href: '/developer',
      icon: Icon.Target,
      badge: rolesCount > 0 ? String(rolesCount) : undefined,
      badgeTone: 'default',
      isActive: pathname === '/developer',
    },
    {
      title: 'Living Portfolio (SSOT)',
      shortTitle: 'Portfolio SSOT',
      href: '/developer/portfolio',
      icon: Icon.Layers,
      badge: ssotBulletsCount > 0 ? String(ssotBulletsCount) : 'Master',
      badgeTone: 'accent',
      isActive: pathname === '/developer/portfolio',
    },
    {
      title: 'Resume Vault',
      shortTitle: 'Resume Vault',
      href: '/developer/resumes',
      icon: Icon.FileText,
      badge: resumesCount > 0 ? String(resumesCount) : 'AI',
      badgeTone: 'default',
      isActive: pathname === '/developer/resumes',
    },
    {
      title: 'JD ↔ Resume Matchmaker',
      shortTitle: 'Matchmaker',
      href: '/developer/matchmaker',
      icon: Icon.Sparkle,
      badge: 'A/B',
      badgeTone: 'signal',
      isActive: pathname === '/developer/matchmaker',
    },
    {
      title: 'Interview Defense Hub',
      shortTitle: 'Defense Hub',
      href: '/developer/defense',
      icon: Icon.Shield,
      badge: 'Drills',
      badgeTone: 'default',
      isActive: pathname === '/developer/defense',
    },
  ];

  const secondaryNav = [
    {
      title: 'Account & Settings',
      shortTitle: 'Settings & Profile',
      href: '/developer/profile',
      icon: Icon.Settings,
      isActive: pathname === '/developer/profile',
    },
  ];

  const activeTier = isSuperAdmin ? 'admin' : (entitlements?.tier ?? 'free');
  const isPro = activeTier === 'pro' || activeTier === 'admin';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Shell: locked to 100% viewport height, never scrolls with page */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-edge bg-card transition-all duration-300 ease-in-out lg:static shrink-0 overflow-hidden ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'w-[72px]' : 'w-64'}`}
      >
        {/* Header Branding */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-edge px-3.5 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <Link
            href="/developer"
            onClick={(e) => {
              if (isCollapsed) {
                e.preventDefault();
                onToggleCollapse();
              } else {
                onCloseMobile();
              }
            }}
            className={`flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity ${
              isCollapsed ? 'justify-center cursor-pointer' : ''
            }`}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'GitGrill CareerOS'}
          >
            <GitGrillLogoMark size="sm" className="shrink-0" />
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-sans text-[15px] font-bold tracking-tight text-content select-none">
                  Git<span className="text-signal">Grill</span>
                </span>
                <span className="rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-signal shrink-0">
                  CareerOS
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle (when expanded) */}
          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-well text-muted hover:border-signal/40 hover:text-signal transition-colors cursor-pointer shrink-0 ml-1"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <Icon.PanelLeftClose className="h-4 w-4" />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-edge bg-well text-muted hover:text-content"
            aria-label="Close menu"
          >
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {/* Studio Navigation Section */}
        <div className={`flex-1 overflow-y-auto py-4 space-y-4 thin-scroll ${isCollapsed ? 'px-2' : 'px-3'}`}>

          <div>
            {!isCollapsed && (
              <div className="px-3 pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                Career Studios
              </div>
            )}
            <nav className="space-y-1.5">
              {studios.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.title : undefined}
                    className={`group relative flex items-center rounded-xl font-mono text-xs font-medium transition-all ${
                      isCollapsed
                        ? 'h-10 w-10 mx-auto justify-center p-0'
                        : 'w-full justify-between px-3 py-2.5'
                    } ${
                      item.isActive
                        ? 'bg-signal/15 text-signal font-bold border border-signal/35 shadow-xs'
                        : 'text-muted hover:bg-well hover:text-content border border-transparent'
                    }`}
                  >
                    {isCollapsed ? (
                      <ItemIcon
                        className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                          item.isActive ? 'text-signal' : 'text-muted group-hover:text-content'
                        }`}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <ItemIcon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              item.isActive ? 'text-signal' : 'text-muted group-hover:text-content'
                            }`}
                          />
                          <span className="truncate">{item.shortTitle}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`ml-2 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider shrink-0 ${
                              item.isActive
                                ? 'bg-signal/20 text-signal'
                                : item.badgeTone === 'signal'
                                ? 'bg-[#ea580c]/15 text-[#ea580c]'
                                : item.badgeTone === 'accent'
                                ? 'bg-purple-500/15 text-purple-400'
                                : 'bg-edge/70 text-muted'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            {isCollapsed ? (
              <div className="my-2 flex justify-center">
                <div className="h-px w-6 bg-edge" />
              </div>
            ) : (
              <div className="px-3 pb-2 pt-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                Settings & Quotas
              </div>
            )}
            <nav className="space-y-1.5">
              {secondaryNav.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.title : undefined}
                    className={`group relative flex items-center rounded-xl font-mono text-xs font-medium transition-all ${
                      isCollapsed
                        ? 'h-10 w-10 mx-auto justify-center p-0'
                        : 'w-full gap-3 px-3 py-2.5'
                    } ${
                      item.isActive
                        ? 'bg-signal/15 text-signal font-bold border border-signal/35 shadow-xs'
                        : 'text-muted hover:bg-well hover:text-content border border-transparent'
                    }`}
                  >
                    <ItemIcon
                      className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        item.isActive ? 'text-signal' : 'text-muted group-hover:text-content'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.shortTitle}</span>}
                  </Link>
                );
              })}

              {isSuperAdmin && (
                <Link
                  href="/recruiter"
                  onClick={onCloseMobile}
                  title={isCollapsed ? 'RecruiterOS Command' : undefined}
                  className={`group relative flex items-center rounded-xl font-mono text-xs font-medium text-[#ea580c] hover:bg-[#ea580c]/10 border border-[#ea580c]/25 transition-all ${
                    isCollapsed
                      ? 'h-10 w-10 mx-auto justify-center p-0'
                      : 'w-full justify-between px-3 py-2'
                  }`}
                >
                  <Icon.Briefcase className="h-4.5 w-4.5 shrink-0 text-[#ea580c]" />
                  {!isCollapsed && (
                    <>
                      <span className="truncate font-semibold ml-3">RecruiterOS Portal</span>
                      <span className="font-mono text-[9px] rounded bg-[#ea580c]/20 px-1 py-0.5 text-[#ea580c] font-bold">
                        ADMIN
                      </span>
                    </>
                  )}
                </Link>
              )}
            </nav>
          </div>
        </div>

        {/* Bottom Tier Dock */}
        <div className="border-t border-edge p-2.5 sm:p-3 bg-well/40">
          {!isCollapsed ? (
            <div className="rounded-xl border border-edge bg-card p-3 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-muted">
                  Current Tier
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    isPro
                      ? 'border border-signal/40 bg-signal/10 text-signal'
                      : 'border border-edge bg-well text-muted'
                  }`}
                >
                  {isSuperAdmin ? 'Super Admin' : activeTier === 'pro' ? 'Pro Plan' : 'Free Starter'}
                </span>
              </div>

              {!isPro && (
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-signal px-2.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-colors cursor-pointer"
                >
                  <Icon.Zap className="h-3.5 w-3.5" />
                  <span>Upgrade (৳৩৯৯/mo)</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              title={isPro ? `Current Tier: ${isSuperAdmin ? 'Super Admin' : 'Pro Plan'}` : "Upgrade via bKash / Nagad"}
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-signal/15 text-signal border border-signal/30 hover:bg-signal/25 transition-colors cursor-pointer group"
            >
              <Icon.Zap className="h-4.5 w-4.5 transition-transform group-hover:scale-110" />
            </button>
          )}
        </div>
      </aside>

      {/* Upgrade MFS Modal */}
      {isUpgradeModalOpen && (
        <BkashNagadModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          defaultPlan="pro_monthly"
        />
      )}
    </>
  );
}
