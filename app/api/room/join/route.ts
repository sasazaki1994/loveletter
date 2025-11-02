import { NextResponse } from "next/server";
import { z } from "zod";

import { joinRoomAsPlayer } from "@/lib/server/game-service";
import { getClientIp } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { isValidShortRoomId, normalizeRoomId } from "@/lib/utils/room-id";

const joinSchema = z.object({
  roomId: z.string().min(1).max(50), // UUIDまたは短いID
  nickname: z.string().min(1).max(24),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request as any);
    const r = rateLimit(`join:${ip}`, 20, 30_000);
    if (!r.ok) {
      return NextResponse.json(
        { error: "しばらくしてからお試しください。" },
        { status: 429, headers: { "Retry-After": Math.ceil((r.resetAt - Date.now()) / 1000).toString() } },
      );
    }

    const body = await request.json();
    const parsed = joinSchema.parse(body);

    // ルームIDを正規化（大文字に変換、空白削除）
    const normalizedRoomId = normalizeRoomId(parsed.roomId);

    const result = await joinRoomAsPlayer(normalizedRoomId, parsed.nickname.trim());

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "入力が不正です。" },
        { status: 400 },
      );
    }
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: errorMessage || "参加に失敗しました。",
        ...(isDev && {
          detail: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 400 },
    );
  }
}


