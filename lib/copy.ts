"use client";

import type { RepoFile } from "./github";

// The browser's copy of GitHub repos' .datlas/ files, in IndexedDB: one record per repo.
// It is only a cache. The browser may delete it, and private windows may not allow it at all,
// so every call here fails soft and the next sync simply fetches again.

export type RepoCopy = {
  root: string; // repoRoot(owner, repo)
  owner: string;
  repo: string;
  via: "installation" | "public"; // read through the login, or straight from GitHub without one
  commit: string;
  etag: string | null;
  files: RepoFile[];
  syncedAt: number;
};

const DB = "datlas";
const STORE = "repos";

let opened: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "root" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opened;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const req = fn(d.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const getCopy = async (root: string) => (await run<RepoCopy | undefined>("readonly", (s) => s.get(root))) ?? null;
export const allCopies = async () => (await run<RepoCopy[]>("readonly", (s) => s.getAll())) ?? [];
export const putCopy = (c: RepoCopy) => run("readwrite", (s) => s.put(c));
export const deleteCopy = (root: string) => run("readwrite", (s) => s.delete(root));
// On logout: private repos' files must not stay readable on a shared computer.
export const clearCopies = () => run("readwrite", (s) => s.clear());
