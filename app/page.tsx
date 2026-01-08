import { RoomLobby } from "@/components/lobby/room-lobby";
import { AdsenseAd } from "@/components/ads/adsense-ad";

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
    </main>
  );
}
