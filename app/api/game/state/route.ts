import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { z } from "zod";

import { fetchGameState } from "@/lib/server/game-service";

const querySchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);

    const { state, etag, lastUpdated } = await fetchGameState(
      parsed.roomId,
      parsed.playerId,
    );

    const clientTag = request.headers.get("if-none-match");
    if (clientTag && clientTag === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      { state, lastUpdated },
      {
        status: 200,
        headers: {
          ETag: etag,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("state error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "パラメータが不正です。" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "状態取得に失敗しました。" },
      { status: 500 },
    );
  }
}

