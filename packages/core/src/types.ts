// The shape of a Dovli workspace. Shared by the web app, the phone app, the editor and sync.

export type PageKind = "doc" | "board";

export interface BoardData {
  /** Full Excalidraw elements, once the board has been opened. */
  elements?: any[];
  /** Simple shape outlines from a template, turned into elements on first open. */
  skeleton?: any[];
  files?: Record<string, any>;
  background?: string;
}

export interface Page {
  id: string;
  parentId: string | null;
  kind: PageKind;
  title: string;
  /** The page icon: a typographic mark or an emoji. */
  mark: string;
  /** Id of a page style from pageStyles.ts; empty means the plain look. */
  style?: string;
  /** Cover image: "g:<preset id>" for a built-in gradient, "file:<id>" for an upload, or a web address. */
  cover?: string | null;
  blocks?: any[];
  board?: BoardData;
  favorite?: boolean;
  /** Set when the page is in the trash. Pages are deleted for good 30 days later. */
  deletedAt?: number | null;
  /** When this page was last opened on any device, for "Recent". Does not count as an edit. */
  lastOpenedAt?: number;
  createdAt: number;
  updatedAt: number;
  order: number;
  expanded?: boolean;
}

export type Route =
  | { name: "home" }
  | { name: "templates" }
  | { name: "trash" }
  | { name: "tag"; tag: string }
  | { name: "page"; id: string };

export type SaveStatus = "saved" | "saving" | "error";

/** A file someone added to a page (image, PDF, audio…), kept on the device and, when signed in, in the cloud. */
export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

/** Address used inside pages for an uploaded file, so it works offline and across devices. */
export const FILE_SCHEME = "dovli-file://";
export const fileUrl = (id: string) => `${FILE_SCHEME}${id}`;
export const fileIdFromUrl = (url: string): string | null =>
  url.startsWith(FILE_SCHEME) ? url.slice(FILE_SCHEME.length) : null;
