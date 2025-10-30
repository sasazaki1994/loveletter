import { NextResponse } from "next/server";
import { z } from "zod";

import { createRoomWithBot } from "@/lib/server/game-service";

const createRoomSchema = z.object({
  nickname: z.string().min(1).max(24),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createRoomSchema.parse(body);

    const result = await createRoomWithBot(parsed.nickname.trim());

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
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

