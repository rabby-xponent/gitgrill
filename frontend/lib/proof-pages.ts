import { API_URL } from './config';
import { authHeaders } from './auth';
import type { DevProfile } from '@/types/profile';

/**
 * Proof Pages (CareerOS — ideation §2.3)
 *
 * The shareable, recruiter-legible evidence artifact. Publishing snapshots the
 * vetted audit server-side; the public URL stays stable across cache expiry
 * and re-runs, and re-publishing bumps a visible version (transparency: the
 * recruiter can see how many times the evidence was refreshed).
 */

export interface ProofMeta {
  roleId: string;
  roleTitle: string;
  publishedAt: number;
  updatedAt: number;
  version: number;
}

/** Structural mirror of the backend ProofSnapshot document. */
export interface ProofSnapshotClient {
  id: string;
  username: string;
  roleId: string;
  roleTitle: string;
  note?: string;
  /** Free-tier attribution flag (§11 decision 12); absent means branded. */
  branded?: boolean;
  version: number;
  publishedAt: number;
  updatedAt: number;
  profile: DevProfile;
}

export interface PublishResult {
  ok: boolean;
  version: number;
  publishedAt: number;
  updatedAt: number;
  url: string;
}

/** Publish (or re-publish) the vetted audit for a target role. */
export async function publishProofPage(input: {
  username: string;
  roleId: string;
  roleTitle: string;
  profile: DevProfile;
  note?: string;
}): Promise<PublishResult> {
  const headers = await authHeaders();
  const res = await fetch(
    `${API_URL}/api/proofs/${encodeURIComponent(input.username)}/${encodeURIComponent(input.roleId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        profile: input.profile,
        roleTitle: input.roleTitle,
        note: input.note,
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    // A `proof_limit` response carries the registry's own locked reason; surface
    // it verbatim (and keep the code so the UI can open the upgrade modal).
    const err = new Error(detail.reason || detail.error || `Publish failed (${res.status})`) as Error & {
      code?: string;
      upgradeTo?: string;
    };
    if (detail.error) err.code = detail.error;
    if (detail.upgradeTo) err.upgradeTo = detail.upgradeTo;
    throw err;
  }
  return res.json();
}

/** Unpublish a proof page — public access is removed immediately. */
export async function unpublishProofPage(
  username: string,
  roleId: string
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(
    `${API_URL}/api/proofs/${encodeURIComponent(username)}/${encodeURIComponent(roleId)}`,
    {
      method: 'DELETE',
      headers,
    }
  );
  if (!res.ok && res.status !== 404) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Unpublish failed (${res.status})`);
  }
}

/** Fetch the public proof snapshot ( recruiter-facing fetch — no auth). */
export async function getPublicProof(
  username: string,
  roleId: string
): Promise<ProofSnapshotClient | null> {
  const res = await fetch(
    `${API_URL}/api/proofs/${encodeURIComponent(username)}/${encodeURIComponent(roleId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load proof page (${res.status})`);
  const data = await res.json();
  return data.proof as ProofSnapshotClient;
}

/** Published proofs for a handle — used to flag live proof links in CareerOS. */
export async function listPublishedProofs(username: string): Promise<ProofMeta[]> {
  const res = await fetch(
    `${API_URL}/api/proofs/by/${encodeURIComponent(username)}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.proofs || []) as ProofMeta[];
}
