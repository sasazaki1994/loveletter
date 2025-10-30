import { NextResponse } from "next/server";
import { z } from "zod";

import { joinRoom } from "@/lib/server/game-service";

const joinSchema = z.object({
  roomId: z.string().uuid(),
  nickname: z.string().min(1).max(24),
  role: z.enum(["player", "observer"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = joinSchema.parse(body);

    const result = await joinRoom(
      parsed.roomId,
      parsed.nickname.trim(),
      parsed.role ?? "observer",
    );

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("joinRoom error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "入力値が不正です。" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "ルーム参加に失敗しました。" },
      { status: 500 },
    );
  }
}

