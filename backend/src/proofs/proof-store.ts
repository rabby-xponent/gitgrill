import { promises as fs } from 'fs';
import path from 'path';
import { DevProfile } from '../types/profile';
import { getAdmin, isDbConfigured } from '../db/supabase';

/**
 * Published Proof Page snapshots (Milestone 24D / 25B).
 *
 * Persisted in Supabase `public.proofs` table for permanent multi-instance
 * availability, with local disk cache mirror for sub-millisecond hot reads.
 */

export interface ProofSnapshot {
  /** Canonical key: `${username}__${roleId}` */
  id: string;
  username: string;
  roleId: string;
  /** Published snapshot version — bumped on every re-publish */
  version: number;
  /** Unix ms of first publish (stable across re-publishes) */
  publishedAt: number;
  /** Unix ms of the most recent publish */
  updatedAt: number;
  /** Denormalized for the public page header */
  roleTitle: string;
  /** Freeform note from the developer, shown on the page */
  note?: string;
  /** Free-tier attribution flag */
  branded?: boolean;
  /** The full vetted audit */
  profile: DevProfile;
}

const PROOFS_DIR = process.env.PROOFS_DIR || './cache/proofs';
const proofPath = (id: string) => path.join(PROOFS_DIR, `${id}.json`);

const proofId = (username: string, roleId: string) =>
  `${username.toLowerCase()}__${roleId}`;

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export async function readProof(username: string, roleId: string): Promise<ProofSnapshot | null> {
  if (!VALID_ID.test(username) || !VALID_ID.test(roleId)) return null;
  const id = proofId(username, roleId);

  // 1. Try Supabase cloud proofs table first
  if (isDbConfigured()) {
    try {
      const admin = getAdmin();
      if (admin) {
        const { data, error } = await admin
          .from('proofs')
          .select('data')
          .eq('id', id)
          .maybeSingle();
        if (!error && data?.data) {
          return data.data as ProofSnapshot;
        }
      }
    } catch {
      // Fall through to disk cache
    }
  }

  // 2. Read from local disk cache
  try {
    const raw = await fs.readFile(proofPath(id), 'utf-8');
    return JSON.parse(raw) as ProofSnapshot;
  } catch {
    return null;
  }
}

/** Remove a published snapshot — public access must actually go away. */
export async function deleteProof(username: string, roleId: string): Promise<boolean> {
  if (!VALID_ID.test(username) || !VALID_ID.test(roleId)) return false;
  const id = proofId(username, roleId);

  let removed = false;

  // 1. Delete from Supabase
  if (isDbConfigured()) {
    try {
      const admin = getAdmin();
      if (admin) {
        const { error } = await admin.from('proofs').delete().eq('id', id);
        if (!error) removed = true;
      }
    } catch {
      // Non-blocking
    }
  }

  // 2. Delete from disk cache
  try {
    await fs.unlink(proofPath(id));
    removed = true;
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  return removed;
}

export async function writeProof(
  input: Omit<ProofSnapshot, 'id' | 'version' | 'publishedAt' | 'updatedAt'>
): Promise<ProofSnapshot> {
  const id = proofId(input.username, input.roleId);
  if (!VALID_ID.test(input.username) || !VALID_ID.test(input.roleId)) {
    throw new Error('Invalid username or roleId');
  }

  const existing = await readProof(input.username, input.roleId);
  const now = Date.now();
  const snapshot: ProofSnapshot = {
    ...input,
    id,
    version: (existing?.version || 0) + 1,
    publishedAt: existing?.publishedAt || now,
    updatedAt: now,
  };

  // 1. Persist to Supabase DB
  if (isDbConfigured()) {
    try {
      const admin = getAdmin();
      if (admin) {
        await admin.from('proofs').upsert({
          id,
          username: snapshot.username.toLowerCase(),
          role_id: snapshot.roleId,
          role_title: snapshot.roleTitle,
          version: snapshot.version,
          published_at: new Date(snapshot.publishedAt).toISOString(),
          updated_at: new Date(snapshot.updatedAt).toISOString(),
          branded: snapshot.branded ?? true,
          note: snapshot.note || null,
          data: snapshot,
        });
      }
    } catch (err) {
      console.warn('[proof-store] Failed to save proof to Supabase:', err);
    }
  }

  // 2. Write to local disk cache
  try {
    await fs.mkdir(PROOFS_DIR, { recursive: true });
    await fs.writeFile(proofPath(id), JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[proof-store] Failed to write local cache:', err);
  }

  return snapshot;
}

/** Published proofs for a username (newest first) — used by CareerOS to flag live links. */
export async function listProofs(username: string): Promise<
  Pick<ProofSnapshot, 'roleId' | 'roleTitle' | 'updatedAt' | 'version'>[]
> {
  if (!VALID_ID.test(username)) return [];

  // 1. Try Supabase cloud proofs table
  if (isDbConfigured()) {
    try {
      const admin = getAdmin();
      if (admin) {
        const { data, error } = await admin
          .from('proofs')
          .select('role_id, role_title, updated_at, version')
          .eq('username', username.toLowerCase())
          .order('updated_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => ({
            roleId: row.role_id,
            roleTitle: row.role_title,
            updatedAt: new Date(row.updated_at).getTime(),
            version: row.version,
          }));
        }
      }
    } catch {
      // Fall through to disk cache
    }
  }

  // 2. Fall back to reading files from disk cache
  try {
    const files = await fs.readdir(PROOFS_DIR);
    const out: ProofSnapshot[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(PROOFS_DIR, file), 'utf-8');
        const snap = JSON.parse(raw) as ProofSnapshot;
        if (snap.username?.toLowerCase() === username.toLowerCase()) {
          out.push(snap);
        }
      } catch {
        // Skip corrupt files
      }
    }
    return out
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => ({
        roleId: p.roleId,
        roleTitle: p.roleTitle,
        updatedAt: p.updatedAt,
        version: p.version,
      }));
  } catch {
    return [];
  }
}
