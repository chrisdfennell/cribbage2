import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }
  const { code, playerId } = createRoom(body.name ?? "");
  return NextResponse.json({ code, playerId });
}
