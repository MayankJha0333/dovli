import type { ReactNode, SVGProps } from "react";
import { cn } from "./cn";

// Icons are drawn on a 16px grid with a 1.5 stroke, so they sit on the text baseline at any size.

const ICONS = {
  home: <path d="M2.8 7.2 8 2.9l5.2 4.3v5.9a.6.6 0 0 1-.6.6H9.6V10H6.4v3.7H3.4a.6.6 0 0 1-.6-.6Z" />,
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
  minus: <path d="M3.2 8h9.6" />,
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
  trash: <path d="M3 4.6h10M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8.4a.8.8 0 0 0 .8.8h4.4a.8.8 0 0 0 .8-.8l.6-8.4" />,
  restore: (
    <>
      <path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4" />
      <path d="M3 2.8v2.6h2.6" />
    </>
  ),
  menu: <path d="M2.8 4.6h10.4M2.8 8h10.4M2.8 11.4h10.4" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  chevron: <path d="m6 3.6 4.4 4.4L6 12.4" />,
  chevronDown: <path d="m3.6 6 4.4 4.4L12.4 6" />,
  chevronLeft: <path d="M10 3.6 5.6 8l4.4 4.4" />,
  arrowRight: <path d="M3.4 8h9M9 4.6 12.4 8 9 11.4" />,
  arrowUp: <path d="M8 12.6v-9M4.6 7 8 3.6 11.4 7" />,
  arrowDown: <path d="M8 3.4v9M4.6 9 8 12.4 11.4 9" />,
  palette: (
    <>
      <path d="M8 2.4a5.6 5.6 0 1 0 0 11.2c1 0 1.4-.7 1.1-1.5-.3-.9.2-1.7 1.2-1.7h1.4a2 2 0 0 0 2-2c0-3.3-2.6-6-5.7-6Z" />
      <circle cx="5.2" cy="7.2" r=".6" fill="currentColor" />
      <circle cx="7.6" cy="5" r=".6" fill="currentColor" />
      <circle cx="10.4" cy="5.6" r=".6" fill="currentColor" />
    </>
  ),
  check: <path d="m3.6 8.4 2.8 2.6 6-6.2" />,
  star: <path d="m8 2.6 1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 11.1l-3.3 1.7.7-3.7-2.7-2.6 3.7-.5Z" />,
  starFilled: <path d="m8 2.6 1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 11.1l-3.3 1.7.7-3.7-2.7-2.6 3.7-.5Z" fill="currentColor" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 4.8V8l2.2 1.4" />
    </>
  ),
  tag: (
    <>
      <path d="M2.8 3.6v3.8l5.6 5.6a.8.8 0 0 0 1.1 0l3.5-3.5a.8.8 0 0 0 0-1.1L7.4 2.8H3.6a.8.8 0 0 0-.8.8Z" />
      <circle cx="5.6" cy="5.6" r=".9" fill="currentColor" />
    </>
  ),
  hash: <path d="M6 2.8 5 13.2M11 2.8l-1 10.4M3 6h10.4M2.6 10H13" />,
  settings: (
    <>
      <path d="M6.9 1.9h2.2l.4 1.6 1.2.6 1.5-.8 1.5 1.5-.8 1.5.6 1.2 1.6.4v2.2l-1.6.4-.6 1.2.8 1.5-1.5 1.5-1.5-.8-1.2.6-.4 1.6H6.9l-.4-1.6-1.2-.6-1.5.8-1.5-1.5.8-1.5-.6-1.2-1.6-.4V6.9l1.6-.4.6-1.2-.8-1.5 1.5-1.5 1.5.8 1.2-.6Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1" />
    </>
  ),
  moon: <path d="M12.8 9.6A5.2 5.2 0 0 1 6.4 3.2a5.2 5.2 0 1 0 6.4 6.4Z" />,
  monitor: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1.4" />
      <path d="M6 13.6h4M8 11v2.6" />
    </>
  ),
  upload: (
    <>
      <path d="M8 10.4V3M5 5.8 8 2.8l3 3" />
      <path d="M3 10.4v1.8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.8" />
    </>
  ),
  download: (
    <>
      <path d="M8 2.8v7.4M5 7.4l3 3 3-3" />
      <path d="M3 10.4v1.8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.8" />
    </>
  ),
  share: (
    <>
      <path d="M8 9.6V2.8M5.2 5.4 8 2.6l2.8 2.8" />
      <path d="M5 7.2H4a1 1 0 0 0-1 1v4.4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8.2a1 1 0 0 0-1-1h-1" />
    </>
  ),
  link: <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />,
  lock: (
    <>
      <rect x="3.4" y="7" width="9.2" height="6.6" rx="1.4" />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" />
    </>
  ),
  shield: (
    <>
      <path d="M8 2.2 3 4v3.8c0 3 2.1 5.2 5 6 2.9-.8 5-3 5-6V4Z" />
      <path d="m5.8 8 1.6 1.6 2.8-3" />
    </>
  ),
  cloud: <path d="M4.6 12.4h6.8a2.8 2.8 0 0 0 .4-5.6 4 4 0 0 0-7.6-.6 3 3 0 0 0 .4 6.2Z" />,
  cloudOff: (
    <>
      <path d="M6 4.3a4 4 0 0 1 5.8 2.5 2.8 2.8 0 0 1 1.7 4.6M10.6 12.4h-6a3 3 0 0 1-.6-5.9" />
      <path d="m2.6 2.6 10.8 10.8" />
    </>
  ),
  cloudCheck: (
    <>
      <path d="M4.6 12.4h6.8a2.8 2.8 0 0 0 .4-5.6 4 4 0 0 0-7.6-.6 3 3 0 0 0 .4 6.2Z" />
      <path d="m6.2 9.2 1.3 1.2 2.4-2.6" />
    </>
  ),
  device: (
    <>
      <rect x="4.4" y="1.8" width="7.2" height="12.4" rx="1.6" />
      <path d="M7.2 12h1.6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M6.4 2.8 7.4 5.6l2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" />
      <path d="m11.6 9.2.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" />
    </>
  ),
  more: (
    <>
      <circle cx="3.6" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.4" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  replace: (
    <>
      <path d="M2.8 5.6h8.4M8.6 3l2.6 2.6-2.6 2.6" />
      <path d="M13.2 10.4H4.8M7.4 7.8l-2.6 2.6 2.6 2.6" />
    </>
  ),
  image: (
    <>
      <rect x="2.4" y="3" width="11.2" height="10" rx="1.6" />
      <circle cx="6" cy="6.6" r="1.1" />
      <path d="m2.8 11.6 3.4-3.2 2.2 2 2-1.6 2.8 2.4" />
    </>
  ),
  file: (
    <>
      <path d="M4 2.6h5.2L12 5.4v7.8a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8Z" />
      <path d="M9 2.8V5.6h2.8" />
    </>
  ),
  importIcon: (
    <>
      <path d="M8 2.8v7M5.2 7 8 9.8 10.8 7" />
      <path d="M2.8 9.6v2.6a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1V9.6" />
    </>
  ),
  logout: (
    <>
      <path d="M6.4 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.4" />
      <path d="M10.4 5.4 13 8l-2.6 2.6M13 8H6.4" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3 13.4c.6-2.4 2.6-3.8 5-3.8s4.4 1.4 5 3.8" />
    </>
  ),
  mail: (
    <>
      <rect x="2.2" y="3.6" width="11.6" height="8.8" rx="1.4" />
      <path d="m2.8 4.6 5.2 4 5.2-4" />
    </>
  ),
  history: (
    <>
      <path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4" />
      <path d="M3 2.8v2.6h2.6M8 5.4V8l1.8 1.2" />
    </>
  ),
  duplicate: (
    <>
      <rect x="5.2" y="5.2" width="8" height="8" rx="1.4" />
      <path d="M10.8 5.2V3.6a.8.8 0 0 0-.8-.8H3.6a.8.8 0 0 0-.8.8V10a.8.8 0 0 0 .8.8h1.6M9.2 7.4v3.6M7.4 9.2h3.6" />
    </>
  ),
  move: (
    <>
      <path d="M2.8 5.2h4l1.4 1.6h5v5.6a.8.8 0 0 1-.8.8H3.6a.8.8 0 0 1-.8-.8Z" />
      <path d="M7.4 10h3.6M9.6 8.6 11 10l-1.4 1.4" />
    </>
  ),
  outline: <path d="M3 4h10M5.2 8h7.8M7.4 12h5.6" />,
  panelRight: (
    <>
      <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.6" />
      <path d="M10 2.8v10.4" />
    </>
  ),
  eye: (
    <>
      <path d="M1.8 8s2.2-4.4 6.2-4.4S14.2 8 14.2 8s-2.2 4.4-6.2 4.4S1.8 8 1.8 8Z" />
      <circle cx="8" cy="8" r="1.8" />
    </>
  ),
  pencil: <path d="M10.6 2.8 13.2 5.4 5.6 13H3v-2.6Z" />,
  textSize: (
    <>
      <path d="M2.4 12.8 5.6 4l3.2 8.8M3.6 9.8h4" />
      <path d="M10 12.8 11.8 8l1.8 4.8M10.6 11.2h2.4" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.4" />
      <path d="M4.4 6.6h.1M6.8 6.6h.1M9.2 6.6h.1M11.6 6.6h.1M4.4 9.4h7.2" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 7.4v3.6M8 5.2v.1" />
    </>
  ),
  alert: (
    <>
      <path d="M8 2.4 14 13H2Z" />
      <path d="M8 6.6v3M8 11.2v.1" />
    </>
  ),
  sync: (
    <>
      <path d="M12.8 6.4A5 5 0 0 0 3.6 5.2M3.2 9.6a5 5 0 0 0 9.2 1.2" />
      <path d="M3.4 2.8v2.6H6M12.6 13.2v-2.6H10" />
    </>
  ),
  bold: <path d="M4.6 3h4a2.4 2.4 0 0 1 0 4.8h-4ZM4.6 7.8h4.8a2.6 2.6 0 0 1 0 5.2H4.6Z" />,
  wand: (
    <>
      <path d="m2.8 13.2 7.6-7.6M9 4.2l2.8 2.8" />
      <path d="M12 1.8v2M13 2.8h-2M13.8 7.2v1.6M14.6 8h-1.6" />
    </>
  ),
  translate: (
    <>
      <path d="M2.4 3.6h6.2M5.5 2.4v1.2M3.6 3.6c.6 2.6 2.4 4.6 4.6 5.4M7.4 3.6C6.8 6 5.2 8 3 9" />
      <path d="m8.6 13.6 2.4-6 2.4 6M9.4 11.8h3.2" />
    </>
  ),
  summary: (
    <>
      <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="1.6" />
      <path d="M5 5.6h6M5 8h6M5 10.4h3.6" />
    </>
  ),
  table: (
    <>
      <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.4" />
      <path d="M2.2 6.4h11.6M2.2 9.8h11.6M6.4 6.4v6.8" />
    </>
  ),
  pdf: (
    <>
      <path d="M4 2.6h5.2L12 5.4v7.8a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8Z" />
      <path d="M5.6 9.6h4.8M5.6 11.6h3" />
    </>
  ),
  callout: (
    <>
      <rect x="2.2" y="3" width="11.6" height="10" rx="2" />
      <path d="M5 6.6h.1M7 6.6h4M5 9.4h.1M7 9.4h4" />
    </>
  ),
  google: (
    <>
      <path d="M14 8.2c0-.5 0-.9-.1-1.3H8v2.5h3.4a2.9 2.9 0 0 1-1.3 1.9v1.6h2.1c1.2-1.1 1.8-2.8 1.8-4.7Z" fill="#4285F4" stroke="none" />
      <path d="M8 14.4c1.7 0 3.2-.6 4.2-1.5l-2.1-1.6c-.6.4-1.3.6-2.1.6-1.6 0-3-1.1-3.5-2.6H2.4v1.7A6.4 6.4 0 0 0 8 14.4Z" fill="#34A853" stroke="none" />
      <path d="M4.5 9.3a3.9 3.9 0 0 1 0-2.6V5H2.4a6.4 6.4 0 0 0 0 5.9Z" fill="#FBBC05" stroke="none" />
      <path d="M8 4.1c.9 0 1.7.3 2.4.9l1.8-1.8A6.4 6.4 0 0 0 2.4 5l2.1 1.7C5 5.2 6.4 4.1 8 4.1Z" fill="#EA4335" stroke="none" />
    </>
  ),
  apple: (
    <path
      d="M10.9 8.5c0-1.5 1.2-2.2 1.3-2.3a2.9 2.9 0 0 0-2.3-1.2c-1-.1-1.9.6-2.4.6-.5 0-1.3-.6-2.1-.6A3.1 3.1 0 0 0 2.8 6.6c-1.1 1.9-.3 4.8.8 6.4.5.8 1.2 1.6 2 1.6s1.1-.5 2.1-.5 1.2.5 2.1.5 1.4-.8 1.9-1.6a6.6 6.6 0 0 0 .9-1.8 2.7 2.7 0 0 1-1.7-2.7ZM9.3 3.9A2.7 2.7 0 0 0 10 1.8a2.8 2.8 0 0 0-1.9 1 2.6 2.6 0 0 0-.7 2c.7 0 1.4-.4 1.9-.9Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  brush: (
    <>
      <path d="M13.2 2.8 8.4 7.6" />
      <path d="m7.6 6.8 1.6 1.6c.5.5.5 1.2 0 1.7l-.5.5" />
      <path d="M6.8 8.6c-1.7-.4-3.4.5-3.6 2.4-.1 1.2-.6 1.8-1.4 2.2 2.2.7 4.6.3 5.6-1.1.7-1 .6-2.3-.6-3.5Z" />
    </>
  ),
  play: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.8" />
      <path d="M6.8 6v4l3.2-2Z" />
    </>
  ),
  italic: <path d="M6.6 3h5M4.4 13h5M9.4 3 6.6 13" />,
  strike: <path d="M3 8h10M10.8 4.6c-.4-1-1.6-1.6-3-1.6-1.8 0-3 .9-3 2.2 0 .9.5 1.4 1.4 1.8M5 11.2c.4 1.1 1.6 1.8 3.2 1.8 1.9 0 3.1-.9 3.1-2.3 0-.4-.1-.8-.3-1.1" />,
  code: <path d="M5.4 4.4 2 8l3.4 3.6M10.6 4.4 14 8l-3.4 3.6" />,
  checkbox: (
    <>
      <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.2" />
      <path d="m5.4 8.2 1.8 1.8 3.4-3.6" />
    </>
  ),
  toggle: <path d="M5.4 3.6 11 8l-5.6 4.4Z" fill="currentColor" />,
  bulletList: (
    <>
      <path d="M6.4 4h7.2M6.4 8h7.2M6.4 12h7.2" />
      <circle cx="3" cy="4" r=".6" fill="currentColor" />
      <circle cx="3" cy="8" r=".6" fill="currentColor" />
      <circle cx="3" cy="12" r=".6" fill="currentColor" />
    </>
  ),
  numberList: (
    <>
      <path d="M6.6 4h7M6.6 8h7M6.6 12h7" />
      <path d="M2.4 2.8h.9v2.8M2.2 7.2c.2-.4.6-.6 1-.6.5 0 .9.3.9.8 0 .7-1.9 1.2-1.9 2h1.9" strokeWidth="1.1" />
    </>
  ),
  outdent: <path d="M7.2 4h6.4M7.2 8h6.4M7.2 12h6.4M4.6 6 2.6 8l2 2" />,
  indent: <path d="M7.2 4h6.4M7.2 8h6.4M7.2 12h6.4M2.6 6l2 2-2 2" />,
  alignLeft: <path d="M2.6 4h10.8M2.6 7.2h7M2.6 10.4h10.8M2.6 13.6h7" />,
  alignCenter: <path d="M2.6 4h10.8M4.6 7.2h6.8M2.6 10.4h10.8M4.6 13.6h6.8" />,
  alignRight: <path d="M2.6 4h10.8M6.4 7.2h7M2.6 10.4h10.8M6.4 13.6h7" />,
  alignJustify: <path d="M2.6 4h10.8M2.6 7.2h10.8M2.6 10.4h10.8M2.6 13.6h10.8" />,
  panelLeft: (
    <>
      <rect x="2.2" y="3" width="11.6" height="10" rx="2" />
      <path d="M6.4 3v10" />
    </>
  ),
  paperclip: <path d="m12.6 7.4-4.9 4.9a2.8 2.8 0 0 1-4-4l5.3-5.3a1.9 1.9 0 0 1 2.7 2.7L6.5 10.9a.9.9 0 0 1-1.3-1.3l4.5-4.5" />,
  viewCards: (
    <>
      <rect x="2.4" y="2.6" width="5" height="7.2" rx="1.2" />
      <rect x="8.6" y="2.6" width="5" height="4.4" rx="1.2" />
      <rect x="2.4" y="11" width="5" height="2.4" rx="1" />
      <rect x="8.6" y="8.2" width="5" height="5.2" rx="1.2" />
    </>
  ),
  viewGrid: (
    <>
      <rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1.1" />
      <rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1.1" />
      <rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1.1" />
      <rect x="8.8" y="8.8" width="4.6" height="4.6" rx="1.1" />
    </>
  ),
  viewList: <path d="M2.6 4.2h10.8M2.6 8h10.8M2.6 11.8h10.8" />,
  sort: <path d="M5 13V3M2.6 5.4 5 3l2.4 2.4M11 3v10M8.6 10.6 11 13l2.4-2.4" />,
  help: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M6.4 6.4a1.7 1.7 0 0 1 3.2.6c0 1.2-1.6 1.4-1.6 2.6M8 11.3v.1" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
export const iconNames = Object.keys(ICONS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("block flex-none", className)}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}
