// An AI app's own address for Dovli: /api/mcp/dvl_…, and anything after it such as …/mcp (see lib/server/mcp.ts).
import { answerMcp, answerMcpDelete, answerMcpGet, answerMcpOptions } from "@/lib/server/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

export const POST = async (req: Request, ctx: Ctx) => answerMcp(req, (await ctx.params).path);
export const GET = async (req: Request, ctx: Ctx) => answerMcpGet(req, (await ctx.params).path);
export const OPTIONS = answerMcpOptions;
export const DELETE = answerMcpDelete;
