import { RoomLobby } from "@/components/lobby/room-lobby";
import { AdsenseAd } from "@/components/ads/adsense-ad";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  const homeSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME;

  return (
    <main className="pb-20">
      <RoomLobby />
      {homeSlot ? (
        <div className="mx-auto mt-8 w-full max-w-5xl px-4">
          <AdsenseAd slot={homeSlot} />
        </div>
      ) : null}
      <div className="mx-auto mt-8 flex w-full max-w-5xl gap-4 px-4 text-xs text-[var(--color-text-muted)]">
        <Link className="underline underline-offset-2" href="/privacy">
          プライバシーポリシー
        </Link>
        <Link className="underline underline-offset-2" href="/terms">
          利用規約
        </Link>
      </div>
    </main>
  );
}
