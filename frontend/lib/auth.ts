/**
 * Session & identity client (M24B — MONETIZATION_BUILD_TRACKER.md).
 *
 * Two backends, one interface:
 * - Supabase mode: when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   are set, identity is real Supabase Auth (GitHub OAuth for developers, email
 *   magic link for recruiters). The access token is forwarded to OUR API
 *   (Authorization header; query param for EventSource) where the backend
 *   verifies the signature.
 * - Dev mode: when Supabase is not configured, sign-in falls through to
 *   POST /api/dev-auth (backend mints a real signed session token locally).
 *
 * `local` mode means signed-out: the local workspace keeps working exactly as
 * before — nothing gated by identity touches localStorage.
 */

import { API_URL } from './config';

export type UserRole = 'developer' | 'recruiter' | 'admin';

export interface AuthUser {
  id: string;
  email: string | null;
  handle: string | null;
  name: string | null;
  role?: UserRole;
}

export type AuthBackend = 'supabase' | 'dev';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const DEV_TOKEN_KEY = 'gitgrill_dev_session_token_v1';
const LEGACY_DEV_TOKEN_KEY = 'devscope_dev_session_token_v1';

export function authBackend(): AuthBackend {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'dev';
}

// --- Supabase client (lazy, browser-only) -----------------------------------

let sbClient: any = null;

async function supabase(): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (typeof window === 'undefined') return null;
  if (!sbClient) {
    try {
      // @ts-ignore
      const { createClient } = await import('@supabase/supabase-js');
      sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { detectSessionInUrl: true, persistSession: true },
      });
    } catch {
      return null;
    }
  }
  return sbClient;
}

// --- Token plumbing -----------------------------------------------------------

export async function getAccessToken(): Promise<string | null> {
  const sb = await supabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem(DEV_TOKEN_KEY) || localStorage.getItem(LEGACY_DEV_TOKEN_KEY);
  }
  return null;
}

function extractHandle(sbUser: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): { email: string | null; handle: string | null; name: string | null; role: UserRole } {
  const meta = sbUser.user_metadata || {};
  const appMeta = sbUser.app_metadata || {};
  const handle =
    (typeof meta.user_name === 'string' && meta.user_name) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username) ||
    null;
  const rawRole = (meta.role as string) || (appMeta.role as string);
  const role: UserRole =
    rawRole === 'recruiter' || rawRole === 'admin' ? rawRole : 'developer';

  return {
    email: sbUser.email ?? null,
    handle: handle ? handle.replace(/^@/, '') : null,
    name: (typeof meta.full_name === 'string' && meta.full_name) || null,
    role,
  };
}

// --- Session resolution -------------------------------------------------------

export async function getSessionUser(): Promise<AuthUser | null> {
  const sb = await supabase();
  let clientUser: AuthUser | null = null;

  // 1. Check if Supabase client has an active authenticated user in browser session
  if (sb) {
    try {
      const { data } = await sb.auth.getUser();
      if (data?.user) {
        const parsed = extractHandle(data.user);
        const derivedHandle = parsed.handle || (data.user.email ? data.user.email.split('@')[0] : null);
        const storedRole = typeof window !== 'undefined' ? (localStorage.getItem('gitgrill_user_role') as UserRole | null) : null;
        clientUser = {
          id: data.user.id,
          email: data.user.email ?? null,
          handle: derivedHandle,
          name: parsed.name || derivedHandle,
          role: parsed.role || storedRole || 'developer',
        };
      }
    } catch {
      // Supabase getUser failed
    }
  }

  // 2. Check token / dev mode
  const token = await getAccessToken();
  if (!token) return clientUser;

  if (token.startsWith('local:')) {
    try {
      return JSON.parse(token.slice(6)) as AuthUser;
    } catch {
      return null;
    }
  }

  // 3. Attempt backend profile enrichment (with timeout so sleeping backend never freezes auth)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.user?.id) {
        const enrichedUser: AuthUser = {
          id: data.user.id,
          email: data.user.email ?? clientUser?.email ?? null,
          handle: data.user.handle ?? clientUser?.handle ?? null,
          name: data.user.name ?? clientUser?.name ?? null,
          role: clientUser?.role || 'developer',
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('gitgrill_current_user_id', enrichedUser.id);
          import('./workspace-sync').then(({ checkAndSyncWorkspace }) => {
            checkAndSyncWorkspace(enrichedUser.id).catch(() => {});
          });
        }
        return enrichedUser;
      }
    }
  } catch {
    // Backend offline / cold-starting
  }

  // 4. Return the verified Supabase user if backend is offline or unconfigured
  if (typeof window !== 'undefined') {
    if (clientUser?.id) {
      localStorage.setItem('gitgrill_current_user_id', clientUser.id);
      import('./workspace-sync').then(({ checkAndSyncWorkspace }) => {
        checkAndSyncWorkspace(clientUser.id).catch(() => {});
      });
    } else {
      localStorage.removeItem('gitgrill_current_user_id');
    }
  }
  return clientUser;
}

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gitgrill_current_user_id');
}

// --- Sign-in / sign-out ---------------------------------------------------------

export async function signInWithGitHub(role: UserRole = 'developer'): Promise<void> {
  const sb = await supabase();
  if (!sb) throw new Error('Supabase is not configured on this deployment.');
  if (typeof window !== 'undefined') {
    localStorage.setItem('gitgrill_user_role', role);
  }
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { role },
    },
  });
  if (error) throw new Error(error.message);
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const sb = await supabase();
  if (!sb) throw new Error('Supabase is not configured on this deployment.');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);
}

/** Signs in a user using email and password. */
export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const sb = await supabase();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw new Error(error.message);
    notifyListeners();
    const user = await getSessionUser();
    if (!user) throw new Error('Could not establish session.');
    return user;
  } else {
    // Dev fallback mode
    const user = await devSignIn(cleanEmail, cleanEmail.split('@')[0]);
    return user;
  }
}

/** Registers a new user using email, password, and assigned role. */
export async function signUpWithPassword(
  email: string,
  password: string,
  role: UserRole = 'developer',
  name?: string
): Promise<{ user: AuthUser | null; confirmationRequired: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const sb = await supabase();
  if (sb) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gitgrill_user_role', role);
    }
    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          role,
          full_name: name || cleanEmail.split('@')[0],
        },
      },
    });
    if (error) throw new Error(error.message);
    notifyListeners();
    const confirmationRequired = !data.session;
    const user = await getSessionUser();
    return { user, confirmationRequired };
  } else {
    // Dev fallback mode
    const user = await devSignIn(cleanEmail, cleanEmail.split('@')[0]);
    return { user, confirmationRequired: false };
  }
}

/** Sends a password reset email instructions link. */
export async function resetPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const sb = await supabase();
  if (sb) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gitgrill_pending_recovery', '1');
    }
    const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (error) throw new Error(error.message);
  }
}

/** Allows an authenticated user to update or set their password. */
export async function updatePassword(newPassword: string): Promise<void> {
  const sb = await supabase();
  if (sb) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gitgrill_pending_recovery');
    }
  }
}

/** Listens for Supabase PASSWORD_RECOVERY auth state changes. */
export function onAuthRecovery(callback: () => void): () => void {
  let unsub: (() => void) | null = null;
  supabase().then((sb) => {
    if (sb) {
      const { data } = sb.auth.onAuthStateChange((event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          callback();
        }
      });
      unsub = () => data.subscription.unsubscribe();
    }
  });
  return () => {
    if (unsub) unsub();
  };
}

function isRecoverySession(session: any): boolean {
  if (!session?.access_token) return false;
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    const amr = payload?.amr;
    if (Array.isArray(amr) && amr.some((entry: any) => entry?.method === 'recovery' || entry === 'recovery')) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * Processes Supabase Auth redirect callbacks (OAuth, magic link, and confirmation tokens).
 */
export async function handleAuthCallback(): Promise<{
  success: boolean;
  error?: string;
  user?: AuthUser;
  isRecovery?: boolean;
}> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Cannot run callback in server environment.' };
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.substring(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);

  const localRecoveryPending =
    typeof window !== 'undefined' && localStorage.getItem('gitgrill_pending_recovery') === '1';

  let isRecovery =
    hashParams.get('type') === 'recovery' ||
    searchParams.get('type') === 'recovery' ||
    hash.includes('type=recovery') ||
    window.location.search.includes('type=recovery') ||
    window.location.href.includes('recovery') ||
    localRecoveryPending;

  // Check for errors returned in either hash or query parameters
  const errCode = hashParams.get('error_code') || searchParams.get('error_code');
  const errDesc = hashParams.get('error_description') || searchParams.get('error_description');
  const rawErr = hashParams.get('error') || searchParams.get('error');

  if (errCode || rawErr) {
    let msg = errDesc
      ? decodeURIComponent(errDesc.replace(/\+/g, ' '))
      : rawErr || 'Authentication link error';
    if (errCode === 'otp_expired') {
      msg = 'This verification link has expired or has already been used. Please request a fresh login link or password reset.';
    }
    return { success: false, error: msg, isRecovery };
  }

  const sb = await supabase();
  if (!sb) {
    return { success: false, error: 'Supabase client is not available.' };
  }

  // Check PKCE query code
  const code = searchParams.get('code');
  if (code) {
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      return { success: false, error: error.message, isRecovery };
    }
    if (isRecoverySession(data?.session)) {
      isRecovery = true;
    }
    notifyListeners();
    const user = await getSessionUser();
    return { success: true, user: user ?? undefined, isRecovery };
  }

  // Check explicit access_token + refresh_token in hash
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      return { success: false, error: error.message, isRecovery };
    }
    if (isRecoverySession(data?.session)) {
      isRecovery = true;
    }
    notifyListeners();
    const user = await getSessionUser();
    return { success: true, user: user ?? undefined, isRecovery };
  }

  // Fallback: check if detectSessionInUrl already established the session
  const { data } = await sb.auth.getSession();
  if (data?.session) {
    if (isRecoverySession(data?.session)) {
      isRecovery = true;
    }
    notifyListeners();
    const user = await getSessionUser();
    return { success: true, user: user ?? undefined, isRecovery };
  }

  return { success: false, error: 'No authorization credentials or session token found in callback URL.' };
}

/** Sends a 6-digit OTP code to the given email address with optional role. */
export async function sendOtp(email: string, role: UserRole = 'developer'): Promise<{ simulated: boolean; code?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const sb = await supabase();
  if (sb) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gitgrill_user_role', role);
    }
    const { error } = await sb.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { role },
      },
    });
    if (error) throw new Error(error.message);
    return { simulated: false };
  } else {
    // Local / Dev fallback mode: simulate OTP generation
    const mockCode = '123456';
    localStorage.setItem(`gitgrill_otp_${cleanEmail}`, mockCode);
    return { simulated: true, code: mockCode };
  }
}

/** Verifies a 6-digit OTP code for the given email address. */
export async function verifyOtp(email: string, token: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();
  const sb = await supabase();
  if (sb) {
    const { data, error } = await sb.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });
    if (error) throw new Error(error.message);
    const user = await getSessionUser();
    if (!user && data.user) {
      const parsed = extractHandle(data.user);
      const manualUser: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? cleanEmail,
        handle: parsed.handle,
        name: parsed.name,
      };
      notifyListeners();
      return manualUser;
    }
    if (!user) throw new Error('Session could not be established.');
    notifyListeners();
    return user;
  } else {
    // Local / Dev mode verification
    const cleanHandle = cleanEmail.split('@')[0];
    const user = await devSignIn(cleanEmail, cleanHandle);
    return user;
  }
}

/** Dev-mode sign-in: backend mints a signed session token, with local fallback */
export async function devSignIn(email: string, handle: string): Promise<AuthUser> {
  const cleanEmail = email.trim();
  const cleanHandle = handle.trim().replace(/^@/, '');
  const localFallbackUser: AuthUser = {
    id: `dev-${cleanHandle || cleanEmail.split('@')[0] || 'user'}`,
    email: cleanEmail || `${cleanHandle}@gitgrill.app`,
    handle: cleanHandle || cleanEmail.split('@')[0],
    name: cleanHandle || cleanEmail.split('@')[0],
  };

  try {
    const res = await fetch(`${API_URL}/api/auth/dev-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: localFallbackUser.id,
        email: cleanEmail,
        handle: cleanHandle,
      }),
    });
    if (res.ok) {
      const { session } = await res.json();
      localStorage.setItem(DEV_TOKEN_KEY, session.access_token);
      const user = await getSessionUser();
      if (user) {
        notifyListeners();
        return user;
      }
    }
  } catch {
    // Backend unreachable or dev-auth unavailable
  }

  // Graceful local workspace access: store local session in localStorage
  localStorage.setItem(DEV_TOKEN_KEY, `local:${JSON.stringify(localFallbackUser)}`);
  notifyListeners();
  return localFallbackUser;
}

export async function signOutSession(): Promise<void> {
  const sb = await supabase();
  if (sb) {
    try {
      await sb.auth.signOut();
    } catch {}
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DEV_TOKEN_KEY);
    localStorage.removeItem(LEGACY_DEV_TOKEN_KEY);
    localStorage.removeItem('gitgrill_current_user_id');
    localStorage.removeItem('gitgrill_user_role');
    localStorage.removeItem('gitgrill_pending_recovery');
  }
  notifyListeners();
}

// --- Change notification ----------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  // Supabase emits real auth events; dev mode is manual (devSignIn notifies).
  supabase().then((sb) => {
    if (sb) {
      const { data } = sb.auth.onAuthStateChange(() => notifyListeners());
      const off = () => data.subscription.unsubscribe();
      wrapped.add(off);
    }
  });
  return () => {
    listeners.delete(listener);
  };
}

const wrapped = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((l) => l());
}

/** Auth header helper for fetch calls to our API. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token && !token.startsWith('local:') ? { Authorization: `Bearer ${token}` } : {};
}
