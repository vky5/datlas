import type { ReactNode } from "react";
import { Folder } from "./icons";
import { STATUSES, type Status } from "@/lib/workspace";

// The clickable card used for projects (first screen) and systems (project overview).
export function Card({ title, aside, quiet, onClick, hint, children }: {
  title: string;
  aside?: ReactNode;
  quiet?: boolean;
  onClick: () => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <button className={"card-btn" + (quiet ? " card-quiet" : "")} onClick={onClick} title={hint}>
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
