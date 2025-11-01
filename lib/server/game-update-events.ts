type RoomUpdateListener = () => void;

interface GameUpdateBus {
  listeners: Map<string, Set<RoomUpdateListener>>;
}

const GLOBAL_KEY = Symbol.for("loveletter.gameUpdateBus");

function getGlobalBus(): GameUpdateBus {
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: GameUpdateBus;
  };

  if (!globalScope[GLOBAL_KEY]) {
    globalScope[GLOBAL_KEY] = {
      listeners: new Map<string, Set<RoomUpdateListener>>(),
    };
  }

  return globalScope[GLOBAL_KEY]!;
}

export function subscribeRoomUpdates(
  roomId: string,
  listener: RoomUpdateListener,
): () => void {
  const bus = getGlobalBus();
  let roomListeners = bus.listeners.get(roomId);

  if (!roomListeners) {
    roomListeners = new Set<RoomUpdateListener>();
    bus.listeners.set(roomId, roomListeners);
  }

  roomListeners.add(listener);

  return () => {
    roomListeners?.delete(listener);

    if (roomListeners && roomListeners.size === 0) {
      bus.listeners.delete(roomId);
    }
  };
}

export function emitRoomUpdate(roomId: string): void {
  const bus = getGlobalBus();
  const roomListeners = bus.listeners.get(roomId);

  if (!roomListeners || roomListeners.size === 0) {
    return;
  }

  // コピーを作成することで、通知中に購読解除されても安全に反復できる
  const listenersSnapshot = [...roomListeners];

  for (const listener of listenersSnapshot) {
    try {
      listener();
    } catch (error) {
      console.error("[GameUpdateBus] listener error", error);
    }
  }
}


