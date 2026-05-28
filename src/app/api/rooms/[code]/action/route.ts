import { NextRequest, NextResponse } from "next/server";
import { applyAction } from "@/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: { playerId?: string; action?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.playerId || !body.action) {
    return NextResponse.json({ error: "Missing playerId/action" }, { status: 400 });
  }
  // We trust the client to send a valid Action shape; applyAction validates further.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = applyAction(code.toUpperCase(), body.playerId, body.action as any);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
