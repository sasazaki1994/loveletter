import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { GameClient } from "./game-client";
import { db } from "@/lib/db/client";
import { rooms } from "@/drizzle/schema";
import { isValidShortRoomId } from "@/lib/utils/room-id";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRoomId(raw: string): Promise<string | null> {
  if (UUID_RE.test(raw)) return raw;

  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!isValidShortRoomId(normalized)) return null;

  const row = (
    await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.shortId, normalized))
  )[0];
  return row?.id ?? null;
}

export default async function GamePage({ params }: { params: { roomId: string } }) {
  const resolvedId = await resolveRoomId(params.roomId);

  if (!resolvedId) {
    redirect("/");
  }

  if (resolvedId !== params.roomId) {
    redirect(`/game/${resolvedId}`);
  }

  return (
    <Suspense fallback={<div className="p-12 text-center text-[var(--color-text-muted)]">読み込み中...</div>}>
      <GameClient roomId={resolvedId} />
    </Suspense>
  );
}

