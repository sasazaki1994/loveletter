import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { z } from "zod";

import type { ClientGameState } from "@/lib/game/types";
import { fetchGameState } from "@/lib/server/game-service";

interface CachedStateEntry {
  etag: string;
  state: ClientGameState | null;
  lastUpdated: string | null;
  expiresAt: number;
}

const STATE_CACHE = new Map<string, CachedStateEntry>();
const CACHE_TTL_MS = 60_000;

const querySchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);

    const now = Date.now();
    const clientTag = request.headers.get("if-none-match");
    const cacheKey = parsed.roomId;
    const cached = STATE_CACHE.get(cacheKey);
    if (cached && cached.expiresAt <= now) {
      STATE_CACHE.delete(cacheKey);
    }

    if (
      cached &&
      cached.expiresAt > now &&
      clientTag &&
      clientTag === cached.etag
    ) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: cached.etag,
          "Cache-Control": "no-store",
        },
      });
    }

    const { state, etag, lastUpdated } = await fetchGameState(
      parsed.roomId,
      parsed.playerId,
    );

    STATE_CACHE.set(cacheKey, {
      etag,
      state,
      lastUpdated,
      expiresAt: now + CACHE_TTL_MS,
    });

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

