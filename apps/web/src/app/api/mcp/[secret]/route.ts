// An AI app's own address for Dovli: /api/mcp/dvl_… (see lib/server/mcp.ts).
import { answerMcp, noStream } from "@/lib/server/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  return answerMcp(req, (await ctx.params).secret);
}
export const GET = noStream;
export const DELETE = noStream;
