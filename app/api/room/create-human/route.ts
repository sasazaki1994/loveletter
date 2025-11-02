import { NextResponse } from "next/server";
import { z } from "zod";

import { createHumanRoom } from "@/lib/server/game-service";
import { getClientIp } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

const createRoomSchema = z.object({
  nickname: z.string().min(1).max(24),
});

export async function POST(request: Request) {
  try {
    // Rate limit: 10 req / 30s per IP
    const ip = getClientIp(request as any);
    const r = rateLimit(`create-human:${ip}`, 10, 30_000);
    if (!r.ok) {
      return NextResponse.json(
        { error: "しばらくしてからお試しください。" },
        { status: 429, headers: { "Retry-After": Math.ceil((r.resetAt - Date.now()) / 1000).toString() } },
      );
    }

    const body = await request.json();
    const parsed = createRoomSchema.parse(body);

    const result = await createHumanRoom(parsed.nickname.trim());

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "ニックネームが不正です。" },
        { status: 400 },
      );
    }
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "ルーム作成に失敗しました。",
        ...(isDev && {
          detail: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500 },
    );
  }
}


