/**
 * Cloud Workspace Sync & First-Login Auto-Import Trigger (M24D).
 *
 * Automatically migrates anonymous/local data (target roles, defense flashcards)
 * to Supabase on first sign-in using POST /api/workspace/import.
 *
 * Keeps localStorage synchronized as a fast offline read cache while ensuring
 * candidate, developer, and recruiter state persists across devices.
 */

import { API_URL } from './config';
import { authHeaders } from './auth';
import { getTargetRoles, getDefenseCards, TargetRole } from './target-roles';

const MIGRATED_FLAG = 'gitgrill_migrated_v1';
const LEGACY_MIGRATED_FLAG = 'devscope_migrated_v1';

export async function checkAndSyncWorkspace(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  const isMigrated =
    localStorage.getItem(MIGRATED_FLAG) === 'true' ||
    localStorage.getItem(LEGACY_MIGRATED_FLAG) === 'true';

  const headers = await authHeaders();
  if (!headers.Authorization) return; // Only sync with authenticated server sessions

  // Step 1: First-login import of existing local state
  if (!isMigrated) {
    try {
      const roles = getTargetRoles();
      const defenseCards = getDefenseCards();

      if (roles.length > 0 || defenseCards.length > 0) {
        const res = await fetch(`${API_URL}/api/workspace/import`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ roles, defenseCards }),
        });

        if (res.ok) {
          localStorage.setItem(MIGRATED_FLAG, 'true');
          localStorage.setItem(LEGACY_MIGRATED_FLAG, 'true');
        }
      } else {
        localStorage.setItem(MIGRATED_FLAG, 'true');
        localStorage.setItem(LEGACY_MIGRATED_FLAG, 'true');
      }
    } catch (err) {
      console.warn('[workspace-sync] first-login auto-import failed:', err);
    }
  }

  // Step 2: Cloud-to-device hydration (cross-device sync)
  try {
    const res = await fetch(`${API_URL}/api/workspace/export`, {
      headers,
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.targetRoles) && data.targetRoles.length > 0) {
        const currentLocal = getTargetRoles();
        const localIds = new Set(currentLocal.map((r: TargetRole) => r.id));
        const merged: TargetRole[] = [...currentLocal];
        for (const cloudRole of data.targetRoles) {
          if (!localIds.has(cloudRole.id)) {
            merged.push(cloudRole);
          }
        }
        if (merged.length > currentLocal.length) {
          localStorage.setItem('gitgrill_target_roles', JSON.stringify(merged));
          localStorage.setItem('devscope_target_roles', JSON.stringify(merged));
        }
      }
    }
  } catch {
    // Non-blocking cross-device hydration
  }
}
