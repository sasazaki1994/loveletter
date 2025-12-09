import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { z } from "zod";

import { fetchGameState } from "@/lib/server/game-service";
import { extractPlayerAuth, verifyToken } from "@/lib/server/auth";
import { players } from "@/drizzle/schema";
import { db } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";
// メモリキャッシュはマルチインスタンスで不整合を生むため、このエンドポイントでは使用しない

const querySchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);

    const clientTag = request.headers.get("if-none-match");

    let perspectiveId: string | undefined = undefined;
    if (parsed.playerId) {
      const row = (
        await db
          .select()
          .from(players)
          .where(and(eq(players.id, parsed.playerId), eq(players.roomId, parsed.roomId)))
      )[0];
      if (row) {
        if (!row.authTokenHash) {
          // Legacy (bot room): allow perspective without token
          perspectiveId = parsed.playerId;
        } else {
          const { playerId, playerToken } = extractPlayerAuth(request);
          const isAuthed = playerId === parsed.playerId && playerToken && verifyToken(playerToken, row.authTokenHash);
          if (isAuthed) {
            perspectiveId = playerId;
          } else {
            // ヒューマンルームでトークン不一致なら閲覧させない
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
        }
      }
    }
    
    // DBから最新状態を取得
    const { state, etag, lastUpdated } = await fetchGameState(
      parsed.roomId,
      perspectiveId,
    );

    if (clientTag && etag && clientTag === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "no-store, must-revalidate",
          "X-Cache": "HIT",
        },
      });
    }

    return NextResponse.json(
      { state, lastUpdated },
      {
        status: 200,
        headers: {
          ETag: etag,
          "Cache-Control": "no-store, must-revalidate",
          "X-Cache": "BYPASS",
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

