import type { CSSProperties, ReactNode } from "react";
import { Folder } from "./icons";
import { STATUSES, type Status } from "@/lib/status";

// The clickable card used for projects (first screen) and systems (project overview).
export function Card({ title, aside, quiet, color, onClick, hint, children }: {
  title: string;
  color?: string; // a system's colour; projects use the accent
  aside?: ReactNode;
  quiet?: boolean;
  onClick: () => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <button className={"card-btn" + (quiet ? " card-quiet" : "") + (color ? " has-hue" : "")} onClick={onClick} title={hint} style={color ? ({ "--hue": color } as CSSProperties) : undefined}>
      <span className="card-top">
        <Folder />
        <b>{title}</b>
        {aside}
      </span>
      {children}
    </button>
  );
}

// Thin bar showing the mix of statuses, widths proportional to counts.
export function StatusBar({ counts }: { counts: Record<Status, number> }) {
  return (
    <span className="status-bar" aria-hidden="true">
      {STATUSES.map((s) => (counts[s] ? <i key={s} className={s} style={{ flex: counts[s] }} /> : null))}
    </span>
  );
}
