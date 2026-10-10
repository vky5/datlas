export type DiagramFile = {
  path: string;
  rel: string;
  name: string;
  format: "d2" | "mmd";
  mod: number;
  size: number;
  note: string;
  projectRoot: string;
  project: string;
  branch: string | null;
};

export type ScanResult = {
  path: string;
  ok: boolean;
  error?: string;
  isGit: boolean;
  scannedAt: number;
  diagrams: DiagramFile[];
  decisions: Decision[];
  problems: Problem[];
  notes: string[]; // the scan stopped early somewhere; shown next to the folder
};

export type Decision = {
  id: string;
  title: string;
  level: "story" | "detail";
  status: "proposed" | "accepted" | "rejected";
  date: string; // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  seq: number; // 1 = oldest decision in its project
  tags: string[];
  realizes: string[];
  supersedes: string[];
  supersededBy: string[];
  detailedBy: string[];
  hasDiagram: boolean;
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
