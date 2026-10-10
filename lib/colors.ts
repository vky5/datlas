// Colours used outside CSS: the graph is drawn on the server, so it can't read CSS variables.
// Keep these in step with the matching variables at the top of app/globals.css.

// Dark theme from vky5.vercel.app: warm near-black surfaces, off-white text, amber accent.
export const SURFACE = "#0e0d0b"; // --surface
export const RAISED = "#151411"; // --raised
export const TEXT = "#f0eeeb"; // --text
export const MUTED = "#9b9893"; // --muted
export const FAINT = "#5b5852"; // replaced/rejected outlines, edges

// Status: green accepted, blue proposed, red rejected. Amber is the accent, so it never means a status.
export const STATUS = { accepted: "#3ecf8e", proposed: "#7aa2f7", rejected: "#f87171", superseded: FAINT } as const;

// One colour per system, the same in the sidebar, the overview cards and the graph.
// Picked to read on dark surfaces and to stay clear of the status colours and the amber accent.
const HUES = ["#a78bfa", "#2dd4bf", "#f472b6", "#67e8f9", "#c4b5a5"];
export const NO_SYSTEM = "#78756f"; // Unsorted and loose diagram files

// Systems are coloured by their position in alphabetical order within a project.
export const systemHue = (index: number) => HUES[index % HUES.length];

// Blend a colour into a base: mix(c, 0.12) is a faint tint of c over the dark surface.
export function mix(hex: string, amount: number, base = SURFACE): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(base.slice(1), 16);
  const ch = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(y + (x - y) * amount).toString(16).padStart(2, "0");
  };
  return "#" + ch(16) + ch(8) + ch(0);
}
