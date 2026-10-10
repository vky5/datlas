import type { ReactNode } from "react";

function I({ children, size = 14 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
export const Folder = () => <I><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></I>;
export const Diagram = () => <I><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M9 6h4a2 2 0 0 1 2 2v7" /></I>;
export const PanelLeft = () => <I><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></I>;
export const Up = () => <I><path d="M12 19V5M5 12l7-7 7 7" /></I>;
export const Refresh = () => <I><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></I>;
export const Trash = () => <I><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></I>;
export const Search = () => <I><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></I>;
export const External = () => <I><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></I>;
export const Chevron = () => <I><path d="M6 9l6 6 6-6" /></I>;
