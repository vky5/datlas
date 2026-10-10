import type { Decision } from "./types";

// Status rules shared by the server (graph) and the browser.
// What the reader should see: an accepted decision that something replaced is "superseded".
export function effectiveStatus(d: Decision): Decision["status"] | "superseded" {
  return d.status === "accepted" && d.supersededBy.length > 0 ? "superseded" : d.status;
}

export type Status = ReturnType<typeof effectiveStatus>;
export const STATUSES: Status[] = ["accepted", "proposed", "rejected", "superseded"];

// Current = still how things work (accepted) or about to (proposed). Rejected and replaced are history.
export const isCurrent = (d: Decision) => ["accepted", "proposed"].includes(effectiveStatus(d));

export function countStatus(decisions: Decision[]): Record<Status, number> {
  const out = { accepted: 0, proposed: 0, rejected: 0, superseded: 0 };
  for (const d of decisions) out[effectiveStatus(d)]++;
  return out;
}
