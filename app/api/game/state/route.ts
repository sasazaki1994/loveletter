import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { z } from "zod";

import { fetchGameState } from "@/lib/server/game-service";
import {
  getStateCache,
  setStateCache,
  getCommonStateCache,
  setCommonStateCache,
} from "@/lib/server/game-state-cache";

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
    
    // プレイヤー別キャッシュをチェック
    const cached = getStateCache(parsed.roomId, parsed.playerId, now);

    if (cached && clientTag && clientTag === cached.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: cached.etag,
          "Cache-Control": "no-store, must-revalidate",
          "X-Cache": "HIT",
        },
      });
    }

    // キャッシュミス時はDBから取得
    const { state, etag, lastUpdated } = await fetchGameState(
      parsed.roomId,
      parsed.playerId,
    );

    // プレイヤー別状態をキャッシュ
    setStateCache(
      parsed.roomId,
      {
        etag,
        state,
        lastUpdated,
      },
      parsed.playerId,
      now,
    );

    // 共通状態もキャッシュ（将来的な最適化のため）
    if (state) {
      setCommonStateCache(
        parsed.roomId,
        {
          gameId: state.id,
          updatedAt: lastUpdated ?? new Date().toISOString(),
          etag: `common:${etag}`,
        },
        now,
      );
    }

    return NextResponse.json(
      { state, lastUpdated },
      {
        status: 200,
        headers: {
          ETag: etag,
          "Cache-Control": "no-store, must-revalidate",
          "X-Cache": "MISS",
        },
      },
    );
  } catch (error) {
    console.error("[API /game/state]", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "パラメータが不正です。",
          ...(process.env.NODE_ENV === "development" && { 
            detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          })
        },
        { status: 400 },
      );
    }
    
    // データベースエラーなどの詳細なエラー情報
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNotFound = errorMessage.includes("not found") || errorMessage.includes("見つかりません");
    
    return NextResponse.json(
      { 
        error: isNotFound ? "ゲームが見つかりませんでした。" : "状態取得に失敗しました。",
        ...(isDev && { 
          detail: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { status: isNotFound ? 404 : 500 },
    );
  }
}

