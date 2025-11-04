import { RoomLobby } from "@/components/lobby/room-lobby";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="pb-20">
      <RoomLobby />
    </main>
  );
}
