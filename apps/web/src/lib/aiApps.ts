// Settings → AI apps: the person's MCP connections (see app/api/ai-apps and lib/server/mcpCore.ts).

import { auth } from "./auth";

export type AppKind = "claude-desktop" | "claude-code" | "codex" | "other";

export interface AIAppConnection {
  id: string;
  name: string;
  app: AppKind;
  scope: "all" | "pages";
  pageIds: string[];
  permission: "view" | "edit";
  enabled: boolean;
  hint: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  lastTool: string | null;
  calls: number;
}

export type AIAppInput = Partial<Pick<AIAppConnection, "name" | "app" | "scope" | "pageIds" | "permission" | "enabled">>;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const token = await auth.accessToken();
  if (!token) throw new Error("Please sign in again.");
  let res: Response;
  try {
    res = await fetch("/api/ai-apps", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach Dovli. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

export const aiApps = {
  list: () => call<{ connections: AIAppConnection[]; limit: number }>({ action: "list" }),
  create: (input: AIAppInput) => call<{ connection: AIAppConnection; url: string }>({ action: "create", ...input }),
  update: (id: string, input: AIAppInput) => call<{ connection: AIAppConnection }>({ action: "update", id, ...input }),
  rotate: (id: string) => call<{ connection: AIAppConnection; url: string }>({ action: "rotate", id }),
  remove: (id: string) => call<{ ok: true }>({ action: "delete", id }),
};

/** What each tool does, in words, for "Last used: …". */
export const TOOL_WORDS: Record<string, string> = {
  get_overview: "looked at your pages",
  list_pages: "listed pages",
  search: "searched",
  read_page: "read a page",
  list_tasks: "listed to-dos",
  create_page: "made a page",
  add_blocks: "added to a page",
  update_block: "changed a page",
  delete_blocks: "deleted blocks",
  move_blocks: "moved blocks",
  update_page: "changed a page",
  set_task: "ticked a to-do",
  trash_page: "moved a page to the trash",
};
