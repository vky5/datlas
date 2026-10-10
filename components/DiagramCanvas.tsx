"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Mermaid renders in the browser; keep results so revisiting a diagram is instant.
const mermaidCache = new Map<string, Promise<string>>();
function renderMermaid(source: string): Promise<string> {
  const key = source;
  let p = mermaidCache.get(key);
  if (!p) {
    p = (async () => {
      const mermaid = (await import("mermaid")).default;
      // Diagrams always sit on a light sheet (see .svgwrap), so one light theme reads well in both modes.
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
      return (await mermaid.render("m" + Math.random().toString(36).slice(2), source)).svg;
    })();
    p.catch(() => mermaidCache.delete(key));
    mermaidCache.set(key, p);
  }
  return p;
}

// Shows one diagram: a ready SVG (D2, rendered on the server) or Mermaid source rendered here.
export function DiagramCanvas({ lang, svg, source, error, note }: {
  lang: "d2" | "mermaid";
  svg?: string | null;
  source?: string | null;
  error?: string | null;
  note?: string | null;
}) {
  const [out, setOut] = useState<string | null>(svg ?? null);
  const [err, setErr] = useState<string | null>(error ?? null);
  const [zoom, setZoom] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setErr(error ?? null);
    if (lang !== "mermaid") {
      setOut(svg ?? null);
      return;
    }
    if (!source || error) return;
    let cancelled = false;
    renderMermaid(source).then(
      (s) => !cancelled && setOut(s),
      (e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [lang, svg, source, error]);

  const size = out?.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/);
  const w = size ? +size[1] : 0;
  const h = size ? +size[2] : 0;
  const fit = useCallback(() => {
    const avail = ref.current?.clientWidth;
    if (avail && w) setZoom(Math.max(0.25, Math.min(1, +((avail - 32) / w).toFixed(2))));
  }, [w]);
  useEffect(() => {
    if (out) fit();
  }, [out, fit]);

  return (
    <section className="diagram">
      <div className="diagram-bar">
        <span className="label">{lang === "d2" ? "D2" : "Mermaid"}{note ? ` · ${note}` : ""}</span>
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
