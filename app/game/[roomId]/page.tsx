import { Suspense } from "react";

import { GameClient } from "./game-client";

export const dynamic = "force-dynamic";

export default function GamePage({ params }: { params: { roomId: string } }) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-[var(--color-text-muted)]">読み込み中...</div>}>
      <GameClient roomId={params.roomId} />
    </Suspense>
  );
}

