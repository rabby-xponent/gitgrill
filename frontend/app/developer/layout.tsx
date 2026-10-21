'use client';

import React, { useState, useEffect } from 'react';
import { DeveloperSidebar } from '@/components/developer/DeveloperSidebar';
import { DeveloperHeader } from '@/components/developer/DeveloperHeader';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gitgrill_sidebar_collapsed_v1');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // ignore
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => {
          const next = !prev;
          try {
            localStorage.setItem('gitgrill_sidebar_collapsed_v1', String(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gitgrill_sidebar_collapsed_v1', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-content selection:bg-signal selection:text-white transition-colors">
      {/* Modern Persistent Sidebar - 100% viewport height, permanently stationary */}
      <DeveloperSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Studio Viewport - Takes remaining width, 100% height, with independent scroll */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <DeveloperHeader
          onOpenMobile={() => setIsMobileOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="flex-1 overflow-y-auto page-texture thin-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}
