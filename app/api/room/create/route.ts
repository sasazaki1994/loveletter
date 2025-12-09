import { NextResponse } from "next/server";
import { z } from "zod";

import { createRoomWithBot } from "@/lib/server/game-service";
import type { CardId } from "@/lib/game/types";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { TestDeckOverrides } from "@/lib/game/deck";
import { buildAuthCookies, getClientIp } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

const createRoomSchema = z.object({
  nickname: z.string().min(1).max(24),
  variants: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    // Bot部屋作成も乱用されうるため緩やかなレートリミットを適用
    const ip = getClientIp(request as any);
    const r = rateLimit(`create-bot:${ip}`, 30, 30_000); // 30 req / 30s
    if (!r.ok) {
      return NextResponse.json(
        { error: "しばらくしてからお試しください。" },
        { status: 429, headers: { "Retry-After": Math.ceil((r.resetAt - Date.now()) / 1000).toString() } },
      );
    }

    const body = await request.json();
    const parsed = createRoomSchema.parse(body);

    // variants は CardId[] として扱う（無効IDはサーバ側で無視）
    const variantIds = (parsed.variants ?? []) as CardId[];
    // テスト用のオプション（開発/テストのみ有効）: ?test=1&seed=...&deck=sentinel,oracle,...
    const url = new URL(request.url);
    const isProd = process.env.NODE_ENV === "production";
    let overrides: TestDeckOverrides | undefined;
    if (!isProd && url.searchParams.get("test") === "1") {
      const seed = url.searchParams.get("seed")?.trim() || undefined;
      const deckParam = url.searchParams.get("deck")?.trim();
      let fixedDeck: CardId[] | undefined;
      if (deckParam) {
        const parts = deckParam.split(/[\s,]+/).filter(Boolean);
        const valid: CardId[] = [];
        for (const token of parts) {
          if ((CARD_DEFINITIONS as any)[token]) {
            valid.push(token as CardId);
          }
        }
        if (valid.length > 0) fixedDeck = valid;
      }
      overrides = { seed, fixedDeck };
    }

    const result = await createRoomWithBot(parsed.nickname.trim(), variantIds, overrides);

    const cookies = buildAuthCookies(result.playerId, null);

    const response = NextResponse.json(
      result,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
    for (const cookie of cookies) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("createRoom error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "ニックネームが不正です。" },
        { status: 400 },
      );
    }
    
    // 開発環境では詳細なエラーメッセージを返す
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { 
        error: "ルーム作成に失敗しました。",
        ...(isDev && { detail: errorMessage, stack: error instanceof Error ? error.stack : undefined })
      },
      { status: 500 },
    );
  }
}

