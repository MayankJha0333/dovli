import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Icons (16px, 1.6 stroke, drawn to sit on the text baseline)         */
/* ------------------------------------------------------------------ */

export const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 7.2 8 3l5 4.2V13a.6.6 0 0 1-.6.6H9.6V10H6.4v3.6H3.6A.6.6 0 0 1 3 13Z" />,
  templates: (
    <>
      <rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1.2" />
      <rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1.2" />
      <rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1.2" />
      <rect x="8.8" y="8.8" width="4.6" height="4.6" rx="1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="m10.5 10.5 3 3" />
    </>
  ),
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" />,
  page: (
    <>
      <path d="M4 2.6h5.2L12 5.4v7.8a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8Z" />
      <path d="M9 2.8V5.6h2.8M6 8.6h4M6 11h2.6" />
    </>
  ),
  pagePlus: (
    <>
      <path d="M8.6 14H4.8a.8.8 0 0 1-.8-.8V3.4a.8.8 0 0 1 .8-.8h4.4L12 5.4v3.2" />
      <path d="M12 10.4v4M10 12.4h4" />
    </>
  ),
  board: (
    <>
      <rect x="2.4" y="3" width="11.2" height="10" rx="1.6" />
      <path d="m5 10 2-2.4 1.6 1.6L11 6.4" />
    </>
  ),
  copy: (
    <>
      <rect x="5.2" y="5.2" width="8" height="8" rx="1.4" />
      <path d="M10.8 5.2V3.6a.8.8 0 0 0-.8-.8H3.6a.8.8 0 0 0-.8.8V10a.8.8 0 0 0 .8.8h1.6" />
    </>
  ),
  trash: (
    <>
      <path d="M3 4.6h10M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8.4a.8.8 0 0 0 .8.8h4.4a.8.8 0 0 0 .8-.8l.6-8.4" />
    </>
  ),
  menu: <path d="M2.8 4.6h10.4M2.8 8h10.4M2.8 11.4h10.4" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  chevron: <path d="m6 3.6 4.4 4.4L6 12.4" />,
  arrowRight: <path d="M3.4 8h9M9 4.6 12.4 8 9 11.4" />,
  palette: (
    <>
      <path d="M8 2.4a5.6 5.6 0 1 0 0 11.2c1 0 1.4-.7 1.1-1.5-.3-.9.2-1.7 1.2-1.7h1.4a2 2 0 0 0 2-2c0-3.3-2.6-6-5.7-6Z" />
      <circle cx="5.2" cy="7.2" r=".6" fill="currentColor" />
      <circle cx="7.6" cy="5" r=".6" fill="currentColor" />
      <circle cx="10.4" cy="5.6" r=".6" fill="currentColor" />
    </>
  ),
  check: <path d="m3.6 8.4 2.8 2.6 6-6.2" />,
};

export function Icon({ name, size = 16 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
