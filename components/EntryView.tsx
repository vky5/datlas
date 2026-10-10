"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DiagramCanvas } from "./DiagramCanvas";
import { External } from "./icons";
import { ago, bytes, effectiveStatus, type Entry } from "@/lib/workspace";
import type { Decision } from "@/lib/types";

type Loaded = {
  text: string | null;
  lang: "d2" | "mermaid" | null;
  svg: string | null;
  source: string | null;
  error: string | null;
  ms: number | null;
};

async function fetchEntry(e: Entry): Promise<Loaded> {
  const q = encodeURIComponent(e.key);
  if (e.kind === "decision") {
    const res = await fetch(`/api/decision?path=${q}`);
    const b = await res.json();
    if (!res.ok) throw new Error(b.error ?? "Could not read this decision");
    return { text: b.text, lang: b.lang, svg: b.svg, source: b.source, error: b.error, ms: b.ms };
  }
  if (e.f.format === "d2") {
    const res = await fetch(`/api/render?path=${q}`);
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: "Render failed" }));
      return { text: null, lang: "d2", svg: null, source: null, error: b.error, ms: null };
    }
    return { text: null, lang: "d2", svg: await res.text(), source: null, error: null, ms: Number(res.headers.get("X-Compile-Ms")) || null };
  }
  const res = await fetch(`/api/source?path=${q}`);
  if (!res.ok) throw new Error("Could not read this file");
  return { text: null, lang: "mermaid", svg: null, source: await res.text(), error: null, ms: null };
}

// Keyed by path + modified time, so an edited file is fetched again and an unchanged one opens instantly.
const cache = new Map<string, Promise<Loaded>>();
const cacheKey = (e: Entry) => `${e.key}:${e.kind === "decision" ? e.d.mod : e.f.mod}`;
export function loadEntry(e: Entry): Promise<Loaded> {
  const k = cacheKey(e);
  let p = cache.get(k);
  if (!p) {
    p = fetchEntry(e);
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}

function Links({ label, ids, all, onOpen }: { label: string; ids: string[]; all: Entry[]; onOpen: (key: string) => void }) {
  if (!ids.length) return null;
  return (
    <div className="links">
      <span className="label">{label}</span>
      {ids.map((id) => {
        const t = all.find((x) => x.kind === "decision" && x.d.id === id);
        return t && t.kind === "decision" ? (
          <button key={id} className="link-chip" onClick={() => onOpen(t.key)} onMouseEnter={() => loadEntry(t)}>
            <span className={"dot " + effectiveStatus(t.d)} /> {t.title}
          </button>
        ) : (
          <span key={id} className="link-chip broken" title="No decision has this id">{id} · missing</span>
        );
      })}
    </div>
  );
}

const STATUS_TEXT: Record<ReturnType<typeof effectiveStatus>, string> = {
  accepted: "Accepted",
  proposed: "Proposed",
  rejected: "Rejected",
  superseded: "Superseded",
};

export function EntryView({ entry, all, onOpen, onTag }: { entry: Entry; all: Entry[]; onOpen: (key: string) => void; onTag: (t: string) => void }) {
  // The previous entry's body stays (dimmed) until the new one arrives, so the pane never flashes empty.
  const [data, setData] = useState<{ key: string; loaded: Loaded } | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const k = cacheKey(entry);

  useEffect(() => {
    let cancelled = false;
    setFail(null);
    loadEntry(entry).then(
      (loaded) => !cancelled && setData({ key: entry.key, loaded }),
      (e) => !cancelled && setFail(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const d: Decision | null = entry.kind === "decision" ? entry.d : null;
  const peers = all.filter((x) => x.projectRoot === entry.projectRoot);
  const status = d ? effectiveStatus(d) : null;
  const stale = !data || data.key !== entry.key;
  const body = data?.loaded;

  return (
    <article className="entry">
      <header className="entry-head fade-in" key={"head:" + entry.key}>
        <h1>{d && <span className="h-seq" title="Order in this project, oldest first">#{d.seq}</span>}{entry.title}</h1>
        <div className="meta">
          {d && status ? (
            <>
              <span className={"status " + status}><span className={"dot " + status} /> {STATUS_TEXT[status]}</span>
              <span className="muted">{d.level === "story" ? "Story" : "Detail"}</span>
              <span className="muted">{d.date}</span>
            </>
          ) : entry.kind === "file" ? (
            <span className="muted">{entry.f.format === "d2" ? "D2" : "Mermaid"} file · changed {ago(entry.f.mod)} · {bytes(entry.f.size)}</span>
          ) : null}
          {entry.tags.map((t) => (
            <button key={t} className="tag" onClick={() => onTag(t)}>#{t}</button>
          ))}
        </div>
      </header>

      {d && d.realizes.length + d.detailedBy.length + d.supersedes.length + d.supersededBy.length > 0 && (
        <div className="relations fade-in" key={"rel:" + entry.key}>
          <Links label="Part of story" ids={d.realizes} all={peers} onOpen={onOpen} />
          <Links label="Implementation details" ids={d.detailedBy} all={peers} onOpen={onOpen} />
          <Links label="Replaces" ids={d.supersedes} all={peers} onOpen={onOpen} />
          <Links label="Replaced by" ids={d.supersededBy} all={peers} onOpen={onOpen} />
        </div>
      )}

      {fail && <p className="error-text">{fail}</p>}

      {!body && !fail && (
        <div className="skeleton-stack" aria-label="Loading">
          <div className="skeleton" style={{ height: 280 }} />
          <div className="skeleton" style={{ height: 14, width: "60%" }} />
          <div className="skeleton" style={{ height: 14, width: "45%" }} />
        </div>
      )}

      {body && (
        <div className={"entry-body" + (stale ? " stale" : " fade-in")} key={"body:" + data!.key}>
          {body.lang && (
            <DiagramCanvas
              lang={body.lang}
              svg={body.svg}
              source={body.source}
              error={body.error}
                />
          )}
          {body.text && (
            <div className="prose">
              <ReactMarkdown>{body.text}</ReactMarkdown>
            </div>
          )}
          {!stale && d && !body.text && <p className="muted">No written reasoning in this decision.</p>}
        </div>
      )}

      <footer className="entry-foot">
        <code title={entry.key}>{entry.key}</code>
        <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy path"}</button>
        <a className="btn" href={`vscode://file${entry.key}`}><External /> Open in editor</a>
      </footer>
    </article>
  );
}
