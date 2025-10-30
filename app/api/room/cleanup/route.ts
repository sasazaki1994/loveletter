export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cleanupStaleActiveRooms } from "@/lib/server/game-service";

const querySchema = z.object({
  minutes: z.coerce.number().int().positive().max(10080).optional(), // up to 7 days
});

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);
    const minutes = parsed.minutes ?? 60;

    const { deletedRooms } = await cleanupStaleActiveRooms(minutes);

    return NextResponse.json(
      { deletedRooms, minutes },
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


