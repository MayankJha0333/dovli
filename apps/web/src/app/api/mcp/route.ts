// Dovli's MCP server with the secret in a header or ?key= (see lib/server/mcp.ts).
import { answerMcp, answerMcpDelete, answerMcpGet, answerMcpOptions } from "@/lib/server/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => answerMcp(req);
export const GET = (req: Request) => answerMcpGet(req);
export const OPTIONS = answerMcpOptions;
export const DELETE = answerMcpDelete;
