import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { players, rooms } from "@/drizzle/schema";
import { db } from "@/lib/db/client";
import { cleanupStaleWaitingRooms } from "@/lib/server/game-service";

export async function GET() {
  try {
    // 自動: 未開始の古いルームをクリーンアップ（15分）
    await cleanupStaleWaitingRooms(15);

    const roomRows = await db
      .select()
      .from(rooms)
      .where(inArray(rooms.status, ["waiting", "active"]))
      .orderBy(rooms.createdAt);

    const ids = roomRows.map((r) => r.id);
    const playerRows = ids.length
      ? await db.select().from(players).where(inArray(players.roomId, ids))
      : [];

    const countMap = new Map<string, number>();
    for (const p of playerRows) {
      countMap.set(p.roomId, (countMap.get(p.roomId) ?? 0) + 1);
    }

    const payload = roomRows.map((r) => ({
      id: r.id,
      shortId: r.shortId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      playerCount: countMap.get(r.id) ?? 0,
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "取得に失敗しました。" }, { status: 500 });
  }
}


