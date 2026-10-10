import { FAINT, MUTED, NO_SYSTEM, RAISED, STATUS, SURFACE, TEXT, mix, systemHue } from "./colors";
import { effectiveStatus } from "./status";
import type { Decision } from "./types";

// One project's decisions as a D2 diagram: a box per system, stories above the details that realize them,
// a dashed arrow from a replaced decision to its replacement. Every decision box links to its page.

// D2 double-quoted string.
const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

// Break a title into lines of about 26 characters, at most 4 lines.
function wrap(title: string): string {
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(/\s+/)) {
    if (line && (line + " " + word).length > 26) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines.length > 4 ? [...lines.slice(0, 3), lines[3] + "…"].join("\n") : lines.join("\n");
}

export function decisionGraph(decisions: Decision[], root: string, highlight: Set<string> | null): string {
  const out: string[] = ["direction: down", `style.fill: ${q(SURFACE)}`];
  const path = new Map<string, string>(); // decision id -> D2 key, e.g. "s0.u1.n4"

  // Group by system, then sub-system. Unsorted gets its own box so nothing floats loose.
  const systems = new Map<string, Map<string, Decision[]>>();
  for (const d of decisions) {
    const [top, sub = ""] = (d.system || "unsorted").split("/");
    if (!systems.has(top)) systems.set(top, new Map());
    const subs = systems.get(top)!;
    subs.set(sub, [...(subs.get(sub) ?? []), d]);
  }

  let n = 0;
  const node = (d: Decision, prefix: string, indent: string) => {
    const key = `${prefix}.n${n++}`;
    path.set(d.id, key);
    const st = effectiveStatus(d);
    const past = st === "rejected" || st === "superseded";
    const dim = highlight && !highlight.has(d.id);
    const link = "/#" + new URLSearchParams({ project: root, entry: d.path }).toString();
    out.push(
      `${indent}${key.split(".").pop()}: ${q(wrap(d.title))} {`,
      `${indent}  link: ${q(link)}`,
      `${indent}  style: {`,
      `${indent}    fill: ${q(RAISED)}`,
      `${indent}    stroke: ${q(STATUS[st])}`,
      `${indent}    stroke-width: 2`,
      `${indent}    border-radius: 6`,
      `${indent}    font-color: ${q(TEXT)}`,
      `${indent}    font-size: ${d.level === "story" ? 15 : 13}`,
      `${indent}    bold: ${d.level === "story"}`,
      `${indent}    opacity: ${dim ? 0.18 : past ? 0.55 : 1}`,
      ...(past ? [`${indent}    stroke-dash: 3`] : []),
      `${indent}  }`,
      `${indent}}`,
    );
  };
  // A system: tinted with its colour, name in the top-left corner.
  const box = (key: string, label: string, indent: string, hue: string, strength: number, size: number) =>
    out.push(
      `${indent}${key}: ${q(label)} {`,
      `${indent}  label.near: top-left`,
      `${indent}  style: { fill: ${q(mix(hue, strength))}; stroke: ${q(mix(hue, 0.45))}; stroke-width: 2; border-radius: 10; font-color: ${q(hue)}; bold: true; font-size: ${size} }`,
    );

  // Same order as the sidebar: named systems alphabetically (that order picks the colour), Unsorted last.
  const named = [...systems.keys()].filter((k) => k !== "unsorted").sort((a, b) => a.localeCompare(b));
  const ordered = [...named, ...(systems.has("unsorted") ? ["unsorted"] : [])];
  let s = 0;
  for (const top of ordered) {
    const subs = systems.get(top)!;
    const hue = top === "unsorted" ? NO_SYSTEM : systemHue(named.indexOf(top));
    const sk = `s${s++}`;
    box(sk, top === "unsorted" ? "Unsorted" : top, "", hue, 0.08, 18);
    let u = 0;
    for (const [sub, list] of [...subs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!sub) {
        list.forEach((d) => node(d, sk, "  "));
        continue;
      }
      const uk = `u${u++}`;
      box(uk, sub, "  ", hue, 0.16, 14);
      list.forEach((d) => node(d, `${sk}.${uk}`, "    "));
      out.push("  }");
    }
    out.push("}");
  }

  // Edges are written story <- detail so the layout keeps stories above their details.
  for (const d of decisions) {
    for (const id of d.realizes)
      if (path.has(id)) out.push(`${path.get(id)} <- ${path.get(d.id)}: { style: { stroke: ${q(FAINT)} } }`);
    for (const id of d.supersedes)
      if (path.has(id)) out.push(`${path.get(id)} -> ${path.get(d.id)}: replaced by { style: { stroke: ${q(FAINT)}; stroke-dash: 4; font-color: ${q(MUTED)} } }`);
  }
  return out.join("\n");
}
