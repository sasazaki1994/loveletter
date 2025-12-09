import { NextResponse } from "next/server";
import { z } from "zod";

import { joinRoomAsPlayer } from "@/lib/server/game-service";
import { buildAuthCookies, getClientIp } from "@/lib/server/auth";
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
    const cookies = buildAuthCookies(result.playerId, result.playerToken);

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
    const code = (error as any)?.code as string | undefined;
    const message = (error as any)?.message as string | undefined;
    const isSeatConflict =
      code === "23505" || message?.includes?.("players_room_id_seat_unique");
    if (isSeatConflict) {
      return NextResponse.json(
        { error: "同時参加により座席を確保できませんでした。再度お試しください。" },
        { status: 409 },
      );
    }
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


