import { NextResponse } from "next/server";
import { z } from "zod";

import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";
import { handleGameAction } from "@/lib/server/game-service";

const cardIdValues = Object.keys(CARD_DEFINITIONS) as [CardId, ...CardId[]];

const payloadSchema = z
  .object({
    cardId: z.enum(cardIdValues).optional(),
    targetId: z.string().uuid().optional(),
    guessedRank: z.number().int().min(1).max(8).optional(),
    effectChoice: z.string().optional(),
  })
  .optional();

const actionSchema = z.object({
  gameId: z.string().uuid(),
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
  type: z.enum(["play_card", "resign"]),
  payload: payloadSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = actionSchema.parse(body);

    const result = await handleGameAction(parsed);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("action error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "アクションの入力値が不正です。" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, message: "アクション処理中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

