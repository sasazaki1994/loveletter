export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cleanupStaleActiveRooms, cleanupStaleWaitingRooms } from "@/lib/server/game-service";

const querySchema = z.object({
  minutes: z.coerce.number().int().positive().max(10080).optional(), // active/finished cleanup window (default 60)
  waitingMinutes: z.coerce.number().int().positive().max(1440).optional(), // waiting cleanup window (default 15)
});

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);
    const minutes = parsed.minutes ?? 60;
    const waitingMinutes = parsed.waitingMinutes ?? 15;

    const [activeResult, waitingResult] = await Promise.all([
      cleanupStaleActiveRooms(minutes),
      cleanupStaleWaitingRooms(waitingMinutes),
    ]);

    return NextResponse.json(
      {
        deletedActiveRooms: activeResult.deletedRooms,
        deletedWaitingRooms: waitingResult.deletedRooms,
        minutes,
        waitingMinutes,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("cleanup error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "パラメータが不正です。" }, { status: 400 });
    }
    return NextResponse.json({ error: "クリーンアップに失敗しました。" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Allow GET to ease manual triggering; delegates to POST logic
  return POST(request);
}


