"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { D2 } from "@terrastruct/d2";

// Both languages render here in the browser. Keep results so revisiting a diagram is instant.
const rendered = new Map<string, Promise<string>>();
function cached(key: string, make: () => Promise<string>): Promise<string> {
  let p = rendered.get(key);
  if (!p) {
    p = make();
    p.catch(() => rendered.delete(key)); // never keep failures; the file may be fixed next time
    rendered.set(key, p);
  }
  return p;
}

function renderMermaid(source: string): Promise<string> {
  return cached("mermaid:" + source, async () => {
    const mermaid = (await import("mermaid")).default;
    // Diagrams always sit on a light sheet (see .svgwrap), so one light theme reads well in both modes.
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
    return (await mermaid.render("m" + Math.random().toString(36).slice(2), source)).svg;
  });
}

// D2.js is d2 compiled to WebAssembly. One engine per page; its ~6 MB bundle loads with the first D2 diagram.
let engine: Promise<D2> | null = null;
function d2Engine(): Promise<D2> {
  if (!engine) {
    engine = import("@terrastruct/d2").then((m) => new m.D2());
    engine.catch(() => (engine = null));
  }
  return engine;
}

// Light theme only: authors set their own box colours, and D2's dark theme puts light text on those light fills.
const D2_OPTIONS = { layout: "elk", pad: 30, themeID: 0 } as const;
const MAX_D2_FILES = 50; // the diagram plus everything it imports
const MISSING = /failed to import "([^"]+)": file does not exist/g;

// D2 reports errors as a JSON list of { errmsg }; keep just the messages.
function d2Errors(e: unknown): string[] {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list.map((x) => String(x?.errmsg ?? x));
  } catch {}
  return [raw];
}

async function readFile(file: string): Promise<string> {
  const res = await fetch(`/api/source?path=${encodeURIComponent(file)}`);
  if (!res.ok) throw new Error(`Could not read ${file}`);
  return res.text();
}

// `path` is where the source lives, so its imports resolve beside it. D2.js can't read the disk,
// so compile, fetch every file it reports missing, and compile again. Without a path, imports fail.
function renderD2(source: string, path: string | null): Promise<string> {
  return cached(`d2:${path}:${source}`, async () => {
    const d2 = await d2Engine();
    const inputPath = path ?? "/diagram.d2";
    const fs: Record<string, string> = { [inputPath]: source };
    for (;;) {
      try {
        const r = await d2.compile({ fs, inputPath, options: D2_OPTIONS });
        return await d2.render(r.diagram, r.renderOptions);
      } catch (e) {
        const errs = d2Errors(e);
        const missing = [...new Set(errs.flatMap((m) => [...m.matchAll(MISSING)].map((x) => x[1])))].filter((f) => !(f in fs));
        if (!path || missing.length === 0 || Object.keys(fs).length + missing.length > MAX_D2_FILES) throw new Error(errs.join("\n"));
        const texts = await Promise.all(missing.map((f) => readFile(f).catch(() => null)));
        if (texts.includes(null)) throw new Error(errs.join("\n"));
        missing.forEach((f, i) => (fs[f] = texts[i]!));
      }
    }
  });
}

// Shows one diagram from its source. `path` is the file it came from, for D2 imports.
export function DiagramCanvas({ lang, source, path = null, error }: {
  lang: "d2" | "mermaid";
  source?: string | null;
  path?: string | null;
  error?: string | null;
}) {
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(error ?? null);
  const [zoom, setZoom] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setErr(error ?? null);
    if (!source || error) return;
    let cancelled = false;
    (lang === "d2" ? renderD2(source, path) : renderMermaid(source)).then(
      (s) => !cancelled && setOut(s),
      (e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [lang, source, path, error]);

  const size = out?.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/);
  const w = size ? +size[1] : 0;
  const h = size ? +size[2] : 0;
  // Fit the whole diagram: as wide as the pane allows, and no taller than about 75% of the window.
  const fit = useCallback(() => {
    const avail = ref.current?.clientWidth;
    if (!avail || !w) return;
    const byWidth = (avail - 32) / w;
    const byHeight = h ? (window.innerHeight * 0.75) / h : 1;
    setZoom(Math.max(0.25, Math.min(1, +Math.min(byWidth, byHeight).toFixed(2))));
  }, [w, h]);
  useEffect(() => {
    if (out) fit();
  }, [out, fit]);

  return (
    <section className="diagram">
      <div className="diagram-bar">
        {out && !err && (
          <div className="zoom">
            <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} aria-label="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in">+</button>
            <button onClick={fit}>Fit</button>
          </div>
        )}
      </div>
      {err ? (
        <pre className="diagram-error">{err}</pre>
      ) : (
        <div className="canvas" ref={ref}>
          {out ? (
            <div key={out.length} className="svgwrap fade-in" style={{ zoom, width: w || undefined, height: h || undefined }} dangerouslySetInnerHTML={{ __html: out }} />
          ) : (
            <div className="skeleton canvas-skeleton" />
          )}
        </div>
      )}
    </section>
  );
}
