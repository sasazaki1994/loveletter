import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { z } from "zod";

import { fetchGameState } from "@/lib/server/game-service";
// メモリキャッシュはマルチインスタンスで不整合を生むため、SSEでは使用しない
import { subscribeRoomUpdates } from "@/lib/server/game-update-events";
import type { ClientGameState } from "@/lib/game/types";
import { extractPlayerAuth, verifyToken } from "@/lib/server/auth";
import { players } from "@/drizzle/schema";
import { db } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";

const querySchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid().optional(),
});

const HEARTBEAT_INTERVAL_MS = 30000; // 30秒ごとにハートビート

/**
 * SSE (Server-Sent Events) ストリーム
 * ゲーム状態の変更をリアルタイムでクライアントに送信
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);
    let effectivePlayerId: string | undefined = undefined;
    if (parsed.playerId) {
      const row = (
        await db
          .select()
          .from(players)
          .where(and(eq(players.id, parsed.playerId), eq(players.roomId, parsed.roomId)))
      )[0];
      if (row) {
        if (!row.authTokenHash) {
          effectivePlayerId = parsed.playerId;
        } else {
          const { playerId, playerToken } = extractPlayerAuth(request);
          if (playerId === parsed.playerId && playerToken && verifyToken(playerToken, row.authTokenHash)) {
            effectivePlayerId = playerId;
          }
        }
      }
    }

    // SSEストリームを作成
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let lastEtag: string | null = null;
        let isClosed = false;
        let heartbeatTimer: NodeJS.Timeout | null = null;
        let unsubscribe: (() => void) | null = null;
        let isSending = false;
        let needsResend = false;

        // ストリーム開始時に初期状態を送信
        const sendState = async () => {
          if (isClosed) return;

          try {
            const now = Date.now();
            // 常にDBから最新状態を取得
            const result = await fetchGameState(parsed.roomId, effectivePlayerId);
            const state: ClientGameState | null = result.state;
            const etag: string = result.etag;
            const lastUpdated: string | null = result.lastUpdated;

            // 状態が変更された場合のみ送信
            if (lastEtag !== etag) {
              lastEtag = etag;
              
              const data = JSON.stringify({
                state,
                lastUpdated,
                etag,
                timestamp: new Date().toISOString(),
              });

              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`),
              );
            }
          } catch (error) {
            if (!isClosed) {
              console.error("[SSE Stream] State fetch error:", error);
              // エラーをクライアントに通知
              const errorData = JSON.stringify({
                error: "状態取得に失敗しました",
                timestamp: new Date().toISOString(),
              });
              controller.enqueue(
                encoder.encode(`event: sse_error\ndata: ${errorData}\n\n`),
              );
            }
          }
        };

        const scheduleSend = () => {
          if (isClosed) return;

          if (isSending) {
            needsResend = true;
            return;
          }

          isSending = true;
          needsResend = false;

          sendState()
            .catch((error) => {
              console.error("[SSE Stream] send error", error);
            })
            .finally(() => {
              isSending = false;
              if (needsResend) {
                scheduleSend();
              }
            });
        };

        // 初期状態を送信
        await sendState();

        // ルーム更新イベントを購読
        unsubscribe = subscribeRoomUpdates(parsed.roomId, scheduleSend);

        // ハートビート（接続が生きていることを確認）
        heartbeatTimer = setInterval(() => {
          if (isClosed) return;
          try {
            controller.enqueue(
              encoder.encode(`: heartbeat ${Date.now()}\n\n`),
            );
          } catch (error) {
            // ストリームが閉じられている場合
            isClosed = true;
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            if (unsubscribe) unsubscribe();
          }
        }, HEARTBEAT_INTERVAL_MS);

        // クライアント切断を検知
        request.signal.addEventListener("abort", () => {
          isClosed = true;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (unsubscribe) unsubscribe();
          try {
            controller.close();
          } catch {
            // すでに閉じられている場合は無視
          }
        });

        // エラーハンドリング（ストリームが閉じられた場合のクリーンアップ）
        // Note: ReadableStreamのcatchメソッドは存在しないため、
        // エラーは上記のtry-catchブロック内で処理される
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Nginxバッファリングを無効化
      },
    });
  } catch (error) {
    console.error("[API /game/stream]", error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "パラメータが不正です。",
          ...(process.env.NODE_ENV === "development" && { 
            detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          })
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNotFound = errorMessage.includes("not found") || errorMessage.includes("見つかりません");
    
    return new Response(
      JSON.stringify({ 
        error: isNotFound ? "ゲームが見つかりませんでした。" : "ストリーム開始に失敗しました。",
        ...(isDev && { 
          detail: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        })
      }),
      { 
        status: isNotFound ? 404 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

