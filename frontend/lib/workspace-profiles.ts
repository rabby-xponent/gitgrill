/**
 * Workspace Profiles & Persistence Engine
 * Manages separate saved states for Technical Recruiters and Software Developers:
 * - Recruiter Profile: Active company, saved candidate screenings, active JD.
 * - Developer Profile: Personal GitHub handle, target roles, past pre-flight audits.
 */

export interface ScreenedCandidateHistory {
  username: string;
  roleId?: string;
  roleTitle?: string;
  evaluatedAt: string;
}

export interface DeveloperAuditHistory {
  username: string;
  targetRole: string;
  evaluatedAt: string;
}

export interface RecruiterWorkspaceProfile {
  companyName: string;
  activeRoleId: string;
  recentScreenings: ScreenedCandidateHistory[];
}

export interface DeveloperWorkspaceProfile {
  githubUsername: string;
  fullName?: string;
  additionalGithubAccounts?: string[];
  linkedinUrl?: string;
  portfolioUrl: string;
  targetRoleId: string;
  customJdText: string;
  recentAudits: DeveloperAuditHistory[];
}

const RECRUITER_KEY = 'gitgrill_recruiter_profile_v1';
const LEGACY_RECRUITER_KEY = 'devscope_recruiter_profile_v1';
const DEVELOPER_KEY = 'gitgrill_developer_profile_v1';
const LEGACY_DEVELOPER_KEY = 'devscope_developer_profile_v1';
const ACTIVE_WORKSPACE_KEY = 'gitgrill_active_workspace_v1';
const LEGACY_ACTIVE_WORKSPACE_KEY = 'devscope_active_workspace_v1';

export type WorkspaceMode = 'recruiter' | 'developer';

export function getActiveWorkspaceMode(): WorkspaceMode {
  if (typeof window === 'undefined') return 'recruiter';
  try {
    const saved = localStorage.getItem(ACTIVE_WORKSPACE_KEY) || localStorage.getItem(LEGACY_ACTIVE_WORKSPACE_KEY);
    return saved === 'developer' ? 'developer' : 'recruiter';
  } catch {
    return 'recruiter';
  }
}

export function setActiveWorkspaceMode(mode: WorkspaceMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function getScopedRecruiterKey(): string {
  if (typeof window === 'undefined') return RECRUITER_KEY;
  const uid = localStorage.getItem('gitgrill_current_user_id');
  return uid ? `gitgrill_${uid}_recruiter_profile_v1` : RECRUITER_KEY;
}

function getScopedDeveloperKey(): string {
  if (typeof window === 'undefined') return DEVELOPER_KEY;
  const uid = localStorage.getItem('gitgrill_current_user_id');
  return uid ? `gitgrill_${uid}_developer_profile_v1` : DEVELOPER_KEY;
}

export function getRecruiterProfile(): RecruiterWorkspaceProfile {
  const defaultProfile: RecruiterWorkspaceProfile = {
    companyName: 'Internal Hiring Team',
    activeRoleId: 'req_senior_fullstack',
    recentScreenings: [],
  };

  if (typeof window === 'undefined') return defaultProfile;
  try {
    const key = getScopedRecruiterKey();
    const raw = localStorage.getItem(key) || (key === RECRUITER_KEY ? localStorage.getItem(LEGACY_RECRUITER_KEY) : null);
    if (!raw) return defaultProfile;
    const parsed = JSON.parse(raw);
    return { ...defaultProfile, ...parsed };
  } catch {
    return defaultProfile;
  }
}

export function saveRecruiterProfile(profile: Partial<RecruiterWorkspaceProfile>): RecruiterWorkspaceProfile {
  const current = getRecruiterProfile();
  const updated = { ...current, ...profile };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getScopedRecruiterKey(), JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }
  return updated;
}

export function recordCandidateScreening(username: string, roleId?: string, roleTitle?: string): void {
  const profile = getRecruiterProfile();
  const filtered = profile.recentScreenings.filter(
    (item) => item.username.toLowerCase() !== username.toLowerCase()
  );
  const updatedList: ScreenedCandidateHistory[] = [
    {
      username,
      roleId,
      roleTitle,
      evaluatedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, 8); // Keep last 8

  saveRecruiterProfile({ recentScreenings: updatedList });
}

export function getDeveloperProfile(): DeveloperWorkspaceProfile {
  const defaultProfile: DeveloperWorkspaceProfile = {
    githubUsername: '',
    fullName: '',
    additionalGithubAccounts: [],
    linkedinUrl: '',
    portfolioUrl: '',
    targetRoleId: 'req_senior_fullstack',
    customJdText: '',
    recentAudits: [],
  };

  if (typeof window === 'undefined') return defaultProfile;
  try {
    const key = getScopedDeveloperKey();
    const raw = localStorage.getItem(key) || (key === DEVELOPER_KEY ? localStorage.getItem(LEGACY_DEVELOPER_KEY) : null);
    if (!raw) return defaultProfile;
    const parsed = JSON.parse(raw);
    return { ...defaultProfile, ...parsed };
  } catch {
    return defaultProfile;
  }
}

export function saveDeveloperProfile(profile: Partial<DeveloperWorkspaceProfile>): DeveloperWorkspaceProfile {
  const current = getDeveloperProfile();
  const updated = { ...current, ...profile };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getScopedDeveloperKey(), JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }
  return updated;
}

export function recordDeveloperAudit(username: string, targetRole: string): void {
  const profile = getDeveloperProfile();
  const filtered = profile.recentAudits.filter(
    (item) => !(item.username.toLowerCase() === username.toLowerCase() && item.targetRole === targetRole)
  );
  const updatedList: DeveloperAuditHistory[] = [
    {
      username,
      targetRole,
      evaluatedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, 8); // Keep last 8

  saveDeveloperProfile({
    githubUsername: username,
    recentAudits: updatedList,
  });
}
