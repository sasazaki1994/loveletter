import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { executeBotTurn } from "@/lib/server/game-service";
import { getClientIp } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  roomId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const r = rateLimit(`bot-turn:${ip}`, 20, 10_000);
    if (!r.ok) {
      return NextResponse.json(
        { error: "Too Many Requests" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = schema.parse(body);

    // バックグラウンドではなく、awaitして完了を待つことで確実に実行させる
    await executeBotTurn(parsed.roomId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /game/bot-action]", error);
    return NextResponse.json(
      { error: "Failed to execute bot turn" },
      { status: 500 }
    );
  }
}

