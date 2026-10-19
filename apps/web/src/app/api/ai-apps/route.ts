// Settings → AI apps: the signed-in person's MCP connections (see lib/server/mcpCore.ts).
//   { action: "list" }                                   → { connections }
//   { action: "create", name, scope, pageIds, permission } → { connection, url }   (url shown once)
//   { action: "update", id, name?, scope?, pageIds?, permission?, enabled? } → { connection }
//   { action: "rotate", id }                             → { connection, url }   (the old address stops)
//   { action: "delete", id }                             → { ok }

import { signedInRoute } from "@/lib/server/api";
import { CloudError } from "@/lib/server/cloudCore";
import { mcpServer } from "@/lib/server/mcp";
import { siteOrigin } from "@/lib/server/share";

export const runtime = "nodejs";

export const POST = signedInRoute(async (user, body, req) => {
  const mcp = mcpServer();
  const address = (secret: string) => `${siteOrigin(req)}/api/mcp/${secret}`;
  const id = typeof body.id === "string" ? body.id : "";
  switch (body.action) {
    case "list":
      return { connections: await mcp.list(user.id), limit: 10 };
    case "create": {
      const { connection, secret } = await mcp.create(user.id, body);
      return { connection, url: address(secret) };
    }
    case "update":
      return { connection: await mcp.update(user.id, id, body) };
    case "rotate": {
      const { connection, secret } = await mcp.rotate(user.id, id);
      return { connection, url: address(secret) };
    }
    case "delete":
      await mcp.remove(user.id, id);
      return { ok: true };
  }
  throw new CloudError("bad_request", "That request didn't make sense.", 400);
}, 20_000);
