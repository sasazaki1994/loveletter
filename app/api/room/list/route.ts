import { NextResponse } from "next/server";

import { listRecentRooms } from "@/lib/server/game-service";

export async function GET() {
  try {
    const rooms = await listRecentRooms();
    return NextResponse.json(
      { rooms },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("list rooms error", error);
    return NextResponse.json(
      { error: "ルーム一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

