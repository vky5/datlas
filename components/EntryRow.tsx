import { loadEntry } from "./EntryView";
import { effectiveStatus, type Entry } from "@/lib/workspace";

// One clickable line for a decision or diagram file: status dot, title, one line of context.
export function EntryRow({ entry, sub, selected, nested, aside, onOpen }: {
  entry: Entry;
  sub: string;
  selected?: boolean;
  nested?: boolean;
  aside?: string;
  onOpen: (key: string) => void;
}) {
  const st = entry.kind === "decision" ? effectiveStatus(entry.d) : null;
  return (
    <button
      data-key={entry.key}
      className={"row" + (nested ? " nested" : "") + (selected ? " on" : "") + (st === "rejected" || st === "superseded" ? " past" : "")}
      onClick={() => onOpen(entry.key)}
      onMouseEnter={() => loadEntry(entry)} // start loading on hover so the click feels instant
    >
      <span className={"dot " + (st ?? "file")} title={st ?? "diagram file"} />
      <span className="row-main">
        <span className="row-title">{entry.title}</span>
        <span className="row-sub">{sub}</span>
      </span>
      {aside && <span className="row-date">{aside}</span>}
    </button>
  );
}

// "Story", "Detail · proposed", "D2 file" …
export function describe(e: Entry): string {
  if (e.kind === "file") return `${e.f.format === "d2" ? "D2" : "Mermaid"} file`;
  const st = effectiveStatus(e.d);
  return (e.d.level === "story" ? "Story" : "Detail") + (st === "accepted" ? "" : ` · ${st}`);
}
