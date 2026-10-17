// The shape of a Dovli workspace. Shared by the web app, the phone app and the editor.

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
  mark: string;
  /** Id of a page style from pageStyles.ts; empty means the plain look. */
  style?: string;
  blocks?: any[];
  board?: BoardData;
  createdAt: number;
  updatedAt: number;
  order: number;
  expanded?: boolean;
}

export type Route =
  | { name: "home" }
  | { name: "templates" }
  | { name: "page"; id: string };

export type SaveStatus = "saved" | "saving" | "error";
