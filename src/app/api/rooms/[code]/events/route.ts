import { NextRequest } from "next/server";
import { subscribe } from "@/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function safeEnqueue(chunk: Uint8Array) {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      }

      const sub = subscribe(code.toUpperCase(), (snap) => {
        const payload = `data: ${JSON.stringify(snap)}\n\n`;
        safeEnqueue(encoder.encode(payload));
      });

      if (!sub) {
        safeEnqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: "Room not found" })}\n\n`,
          ),
        );
        controller.close();
        return;
      }

      // Heartbeat every 25s to keep proxies / browsers from timing out
      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: heartbeat\n\n`));
      }, 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        sub.unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
