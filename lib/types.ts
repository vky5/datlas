export type DiagramFile = {
  path: string;
  name: string;
  format: "d2" | "mmd";
  mod: number;
  size: number;
  projectRoot: string;
  project: string;
};

export type ScanResult = {
  path: string;
  ok: boolean;
  error?: string;
  diagrams: DiagramFile[];
  decisions: Decision[];
  problems: Problem[];
  notes: string[]; // the scan stopped early somewhere; shown next to the folder
};

export type Decision = {
  id: string;
  title: string;
  level: "story" | "detail";
  system: string; // e.g. "processors" or "processors/build"; "" when missing (shown under Unsorted)
  status: "proposed" | "accepted" | "rejected";
  date: string; // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  tags: string[];
  realizes: string[];
  supersedes: string[];
  supersededBy: string[];
  detailedBy: string[];
  mod: number;
  path: string;
  projectRoot: string;
  project: string;
};

export type Problem = {
  path: string;
  project: string;
  severity: "error" | "warning";
  message: string;
};
