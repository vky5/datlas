"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { DiagramCanvas } from "./DiagramCanvas";
import type { Project } from "@/lib/workspace";

// How decisions connect: one box per system, stories above their details, dashed arrows for replacements.
// The server draws it with D2 (same look as every other diagram). Boxes are links to the decision.
export function GraphView({ project, highlight, tag, onOpen }: {
  project: Project;
  highlight: string[] | null; // decision ids to keep bright; null = no filter
  tag: string | null;
  onOpen: (key: string) => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const body = JSON.stringify({ project: project.root, highlight });

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/graph", { method: "POST", headers: { "Content-Type": "application/json" }, body })
      .then(async (res) => {
        const b = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(b.error ?? "Could not draw the graph");
        else {
          setEmpty(!!b.empty);
          setSvg(b.svg);
        }
      })
      .catch(() => !cancelled && setError("Could not reach the server"));
    return () => {
      cancelled = true;
    };
  }, [body]);

  // Box links carry "#project=…&entry=…"; open them in place instead of navigating.
  const onClick = (ev: MouseEvent) => {
    const a = (ev.target as Element).closest("a");
    const href = a?.getAttribute("href");
    if (!href?.includes("#")) return;
    ev.preventDefault();
    const entry = new URLSearchParams(href.split("#")[1]).get("entry");
    if (entry) onOpen(entry);
  };

  return (
    <div className="graph fade-in">
      <header>
        <h1>How {project.name}&apos;s decisions connect</h1>
        <p className="muted">
          Stories sit above the details that realize them. Dashed arrows go from a replaced decision to its replacement.
          {tag ? ` Decisions without #${tag} are faded.` : " Pick a tag on the left to fade everything else."} Click a box to open it.
        </p>
      </header>
      {empty ? (
        <p className="muted">No decisions in this project yet.</p>
      ) : (
        <div onClick={onClick}>
          <DiagramCanvas lang="d2" svg={svg} error={error} />
        </div>
      )}
    </div>
  );
}
