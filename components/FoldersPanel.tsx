"use client";

import { useCallback, useEffect, useState } from "react";
import { Folder, Trash, Up } from "./icons";
import type { Workspace } from "@/lib/workspace";

type Listing = { path: string; parent: string | null; dirs: { name: string; path: string; isGit: boolean }[] };

// Choose which folders datlas reads. Saved in this browser only.
export function FoldersPanel({ ws, onClose, intro = true }: { ws: Workspace; onClose?: () => void; intro?: boolean }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const browse = useCallback(async (dir?: string) => {
    const res = await fetch("/api/dirs" + (dir ? `?path=${encodeURIComponent(dir)}` : ""));
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Could not open that folder");
    setError(null);
    setListing(body);
  }, []);
  useEffect(() => {
    browse();
  }, [browse]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);

  const addTyped = async () => {
    const p = typed.trim();
    if (!p) return;
    const res = await fetch(`/api/dirs?path=${encodeURIComponent(p)}`);
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Could not use that folder");
    ws.add(body.path);
    setTyped("");
    setError(null);
  };

  return (
    <div className="folders">
      {intro && (
        <>
          <div className="folders-head">
            <h2>Folders</h2>
            {onClose && <button className="btn" onClick={onClose}>Done</button>}
          </div>
          <p className="muted">datlas reads decisions (<code>.datlas/*.md</code>) and diagram files (<code>.d2</code>, <code>.mmd</code>) from these folders and everything inside them.</p>
        </>
      )}

      {ws.saved.length > 0 && (
        <ul className="saved">
          {ws.saved.map((d) => {
            const s = ws.scans[d];
            return (
              <li key={d}>
                <Folder />
                <div className="grow">
                  <code>{d}</code>
                  <small className={s && !s.ok ? "error-text" : "muted"}>
                    {!s ? "scanning…" : !s.ok ? s.error : `${s.decisions.length} decision${s.decisions.length === 1 ? "" : "s"} · ${s.diagrams.length} diagram file${s.diagrams.length === 1 ? "" : "s"}`}
                  </small>
                  {s?.notes?.map((n) => <small key={n} className="warn-text">{n}</small>)}
                </div>
                <button className="icon" onClick={() => ws.remove(d)} aria-label={`Stop reading ${d}`} title="Remove"><Trash /></button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="picker">
        <div className="picker-bar">
          <button className="icon" onClick={() => browse(listing?.parent ?? undefined)} disabled={!listing?.parent} aria-label="Up one folder"><Up /></button>
          <code className="grow">{listing?.path ?? "…"}</code>
          <button className="btn primary" disabled={!listing || ws.saved.includes(listing.path)} onClick={() => listing && ws.add(listing.path)}>
            {listing && ws.saved.includes(listing.path) ? "Added" : "Add this folder"}
          </button>
        </div>
        <ul className="picker-list">
          {listing?.dirs.map((d) => (
            <li key={d.path}>
              <button className="grow" onClick={() => browse(d.path)}>
                <Folder /> {d.name}
                {d.isGit && <small>git</small>}
              </button>
              {ws.saved.includes(d.path) ? <small className="muted">added</small> : <button className="btn" onClick={() => ws.add(d.path)}>Add</button>}
            </li>
          ))}
          {listing && listing.dirs.length === 0 && <li className="muted pad">No sub-folders.</li>}
        </ul>
      </div>
      {error && <p className="error-text">{error}</p>}

      <form className="paste" onSubmit={(e) => { e.preventDefault(); addTyped(); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or paste a folder path" aria-label="Folder path" />
        <button className="btn" type="submit">Add</button>
      </form>
      <p className="muted small">Only folders inside your home directory. Saved in this browser.</p>
    </div>
  );
}
