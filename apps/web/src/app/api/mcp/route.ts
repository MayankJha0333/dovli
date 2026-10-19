// Dovli's MCP server with the secret in a header: "Authorization: Bearer dvl_…" (see lib/server/mcp.ts).
import { answerMcp, noStream } from "@/lib/server/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return answerMcp(req, auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null);
}
export const GET = noStream;
export const DELETE = noStream;
