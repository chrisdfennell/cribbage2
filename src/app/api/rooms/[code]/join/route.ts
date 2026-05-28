import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "@/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }
  const result = joinRoom(code.toUpperCase(), body.name ?? "");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ playerId: result.playerId, code: code.toUpperCase() });
}
