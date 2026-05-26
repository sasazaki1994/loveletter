import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db, type DbClient } from "@/lib/db/client";
import { buildFullDeck, draw, shuffleDeck, getTestDeckOverrides, type TestDeckOverrides } from "@/lib/game/deck";
import type { VariantConfig } from "@/lib/game/variants";
import { isSupportedVariantCardId } from "@/lib/game/variant-support";
import { generateOpaqueToken, hashToken } from "@/lib/server/auth";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { generateShortRoomId } from "@/lib/utils/room-id";
import type {
  CardId,
  ClientGameState,
  GameActionRequest,
  GameActionResult,
  PlayerId,
  PollingResponse,
} from "@/lib/game/types";
import { invalidateStateCache } from "@/lib/server/game-state-cache";
import { type DeckState } from "@/lib/server/game/hand-service";
import { mapToClientState } from "@/lib/server/game/state-mapper";
import { handlePlayCard } from "@/lib/server/game/action-service";
import { executeBotTurn } from "@/lib/server/game/bot-turn-service";
import { beginTurn, advanceTurn } from "@/lib/server/game/turn-service";
import { concludeRound, determineWinnersByHand, eliminatePlayers } from "@/lib/server/game/round-service";
import {
  actions,
  games,
  hands,
  logs,
  playerRoleEnum,
  players,
  rooms,
} from "@/drizzle/schema";


const BOT_NAMES = [
  "Automaton Aurelia",
  "Clockwork Warden",
  "Gilded Echo",
  "Ivory Sentinel",
  "Velvet Apparatus",
  "Runic Arbiter",
];

const MAX_LOGS = 50;

type PlayerRole = (typeof playerRoleEnum.enumValues)[number];

type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbErrorLike = { code?: string; message?: string };
type RoomWithHostPlayerId = typeof rooms.$inferSelect & { hostPlayerId?: string | null };

const BASE_CARD_BY_RANK: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, CardId> = {
  1: "sentinel",
  2: "oracle",
  3: "duelist",
  4: "warder",
  5: "legate",
  6: "arbiter",
  7: "vizier",
};

function inferVariantConfigFromCards(cards: CardId[]): VariantConfig {
  const seenByRank = new Map<number, Set<CardId>>();
  for (const card of cards) {
    const def = CARD_DEFINITIONS[card];
    if (!def) continue;
    const rank = def.rank;
    if (rank < 1 || rank > 7) continue;
    const set = seenByRank.get(rank) ?? new Set<CardId>();
    set.add(card);
    seenByRank.set(rank, set);
  }

  const cfg: VariantConfig = {};
  for (const rank of [1, 2, 3, 4, 5, 6, 7] as const) {
    const set = seenByRank.get(rank);
    if (!set) continue;
    const base = BASE_CARD_BY_RANK[rank];
    const variant = Array.from(set).find((id) => id !== base);
    if (variant) cfg[rank] = variant;
  }
  return cfg;
}

export async function cleanupStaleActiveRooms(maxAgeMinutes = 60) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const stale = await db
    .select({ roomId: rooms.id })
    .from(rooms)
    .innerJoin(games, eq(games.roomId, rooms.id))
    .where(
      and(
        inArray(rooms.status, ["active", "finished"]),
        lt(games.updatedAt, cutoff),
      ),
    );

  const ids = stale.map((r) => r.roomId);
  if (ids.length === 0) return { deletedRooms: 0 } as const;

  await db.transaction(async (tx) => {
    // Remove players explicitly to avoid orphan rows
    await tx.delete(players).where(inArray(players.roomId, ids));
    // Delete rooms (will cascade games/actions/hands/logs)
    await tx.delete(rooms).where(inArray(rooms.id, ids));
  });

  return { deletedRooms: ids.length } as const;
}

export async function cleanupStaleWaitingRooms(maxAgeMinutes = 15) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const stale = await db
    .select({ roomId: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.status, "waiting"), lt(rooms.createdAt, cutoff)));

  const ids = stale.map((r) => r.roomId);
  if (ids.length === 0) return { deletedRooms: 0 } as const;

  await db.transaction(async (tx) => {
    await tx.delete(players).where(inArray(players.roomId, ids));
    await tx.delete(rooms).where(inArray(rooms.id, ids));
  });

  return { deletedRooms: ids.length } as const;
}

/**
 * 一意な短いルームIDを生成（重複チェック付き）
 */
async function generateUniqueShortId(tx: TransactionClient, maxRetries = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const shortId = generateShortRoomId();
    const existing = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.shortId, shortId))
      .limit(1);
    
    if (existing.length === 0) {
      return shortId;
    }
  }
  throw new Error("短いルームIDの生成に失敗しました");
}

export async function createRoomWithBot(
  nickname: string,
  variantIds?: CardId[],
  overrides?: TestDeckOverrides,
) {
  return db.transaction(async (tx) => {
    const playerToken = generateOpaqueToken(32);
    const tokenHash = hashToken(playerToken);
    const shortId = await generateUniqueShortId(tx);
    const [room] = await tx
      .insert(rooms)
      .values({ shortId })
      .returning();

    const hostAvatar = randomAvatarSeed();
    const [host] = await tx
      .insert(players)
      .values({
        roomId: room.id,
        nickname,
        seat: 0,
        role: "player",
        avatarSeed: hostAvatar,
        authTokenHash: tokenHash,
      })
      .returning();

    const shuffledBotNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const botValues = Array.from({ length: 3 }, (_, index) => ({
      roomId: room.id,
      nickname: shuffledBotNames[index] ?? `Clockwork Bot ${index + 1}`,
      seat: index + 1,
      role: "player" as PlayerRole,
      isBot: true,
      avatarSeed: randomAvatarSeed(),
    }));

    const botRows = await tx.insert(players).values(botValues).returning();

    const variantConfig: VariantConfig = buildVariantConfigFromIds(variantIds ?? []);
    const setup = await setupNewGame(
      tx,
      room.id,
      [host, ...botRows].sort((a, b) => a.seat - b.seat),
      variantConfig,
      overrides,
    );

    await tx
      .update(rooms)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(rooms.id, room.id));

    return {
      roomId: room.id,
      playerId: host.id,
      playerToken,
      botId: botRows[0]?.id,
      botIds: botRows.map((bot) => bot.id),
      gameId: setup.game.id,
    };
  });
}

export async function createHumanRoom(nickname: string, userId?: string | null) {
  return db.transaction(async (tx) => {
    const shortId = await generateUniqueShortId(tx);
    const [room] = await tx
      .insert(rooms)
      .values({ status: "waiting", shortId })
      .returning();

    const avatarSeed = randomAvatarSeed();
    const isAccountMode = Boolean(userId);
    const token = isAccountMode ? null : generateOpaqueToken(32);
    const tokenHash = isAccountMode || !token ? null : hashToken(token);

    const [host] = await tx
      .insert(players)
      .values({
        roomId: room.id,
        userId: userId ?? null,
        nickname,
        seat: 0,
        role: "player" as PlayerRole,
        isBot: false,
        avatarSeed,
        authTokenHash: tokenHash ?? null,
      })
      .returning();

    // ルーム作成者をホストとして固定（seat 依存をやめる）
    await tx
      .update(rooms)
      .set({ hostPlayerId: host.id, updatedAt: new Date() })
      .where(eq(rooms.id, room.id));

    return {
      roomId: room.id,
      shortId: room.shortId,
      playerId: host.id,
      playerToken: token ?? undefined,
      status: "waiting" as const,
    };
  });
}

/**
 * ルームID（UUIDまたは短いID）からルームを取得
 */
async function findRoomByIdentifier(tx: TransactionClient, identifier: string) {
  // UUID形式かどうかチェック
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidPattern.test(identifier)) {
    // UUIDで検索
    const roomRows = await tx.select().from(rooms).where(eq(rooms.id, identifier));
    return roomRows[0] ?? null;
  } else {
    // 短いIDで検索（大文字に変換）
    const normalized = identifier.trim().toUpperCase();
    const roomRows = await tx.select().from(rooms).where(eq(rooms.shortId, normalized));
    return roomRows[0] ?? null;
  }
}

export async function joinRoomAsPlayer(roomId: string, nickname: string, userId?: string | null) {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const room = await findRoomByIdentifier(tx, roomId);
        if (!room) {
          throw new Error("ルームが見つかりません");
        }
        if (room.status !== "waiting") {
          throw new Error("このルームは参加を受け付けていません");
        }

        const existingPlayers = await tx
          .select()
          .from(players)
          .where(eq(players.roomId, room.id))
          .for("update");
        if (existingPlayers.length >= 4) {
          throw new Error("満席です");
        }

        const taken = existingPlayers.map((p) => p.seat);
        let seat = 0;
        for (let i = 0; i < 4; i += 1) {
          if (!taken.includes(i)) {
            seat = i;
            break;
          }
        }

        const avatarSeed = randomAvatarSeed();
        const isAccountMode = Boolean(userId);
        const token = isAccountMode ? null : generateOpaqueToken(32);
        const tokenHash = isAccountMode || !token ? null : hashToken(token);

        const [player] = await tx
          .insert(players)
          .values({
            roomId: room.id,
            userId: userId ?? null,
            nickname,
            seat,
            role: "player" as PlayerRole,
            isBot: false,
            avatarSeed,
            authTokenHash: tokenHash ?? null,
          })
          .returning();

        return {
          roomId: room.id,
          shortId: room.shortId,
          playerId: player.id,
          playerToken: token ?? undefined,
          seat,
        } as const;
      });
    } catch (error) {
      const typedError = error as DbErrorLike;
      const code = typedError.code;
      const message = typedError.message;
      const isUniqueSeat =
        code === "23505" || message?.includes?.("players_room_id_seat_unique");
      const shouldRetry = isUniqueSeat && attempt < maxRetries;
      if (shouldRetry) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("座席の確保に失敗しました。時間をおいて再試行してください。");
}

export async function startHumanGame(roomId: string, hostId: string) {
  const result = await db.transaction(async (tx) => {
    const roomRows = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for("update");
    const room = roomRows[0];
    if (!room) throw new Error("ルームが見つかりません");

    // ゲーム行をロック（room_id は unique）
    const existingGames = await tx.select().from(games).where(eq(games.roomId, roomId)).for("update");
    const existingGame = existingGames[0] ?? null;

    const playerRows = await tx
      .select()
      .from(players)
      .where(eq(players.roomId, roomId))
      .for("update");
    const orderedPlayers = playerRows
      .filter((p) => p.role === "player")
      .sort((a, b) => a.seat - b.seat);
    if (orderedPlayers.length < 2) throw new Error("開始には2人以上が必要です");

    const host = playerRows.find((p) => p.id === hostId);
    if (!host) throw new Error("ホストのみ開始できます");
    // rooms.hostPlayerId が存在する場合はそれを優先し、移行前データは seat0 をホストとみなす
    const roomWithHost = room as RoomWithHostPlayerId;
    const expectedHostId = roomWithHost.hostPlayerId ?? playerRows.find((p) => p.seat === 0)?.id ?? null;
    if (!expectedHostId || host.id !== expectedHostId) throw new Error("ホストのみ開始できます");

    const isRestart = Boolean(
      existingGame && (existingGame.phase === "finished" || room.status === "finished"),
    );

    if (room.status === "active" && !isRestart) {
      throw new Error("ゲーム進行中です");
    }

    // 初回開始: waiting かつ games が存在しない
    if (!isRestart) {
      if (room.status !== "waiting") {
        throw new Error("すでに開始済みです");
      }
      if (existingGames.length > 0) {
        throw new Error("すでにゲームが存在します");
      }
      const setup = await setupNewGame(tx, roomId, orderedPlayers);
      await tx
        .update(rooms)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(rooms.id, roomId));
      return { gameId: setup.game.id } as const;
    }

    // 次ゲーム開始: 既存ゲームのデータを掃除し、新しいゲームを作成する
    if (!existingGame) {
      throw new Error("ゲームが見つかりません");
    }
    if (existingGame.phase !== "finished") {
      throw new Error("ゲームが終了していません");
    }

    // 次ラウンド番号（クライアント演出/表示用）
    const nextRound = (existingGame.round ?? 1) + 1;

    // 直前ゲームのデッキ内容からバリアント置換を推定（DBに永続化していないため）
    const handRows = await tx.select().from(hands).where(eq(hands.gameId, existingGame.id));
    const deckState = existingGame.deckState as DeckState;
    const cardBag: CardId[] = [];
    cardBag.push(...((existingGame.discardPile ?? []) as CardId[]));
    cardBag.push(...((existingGame.revealedSetupCards ?? []) as CardId[]));
    cardBag.push(...((deckState?.drawPile ?? []) as CardId[]));
    if (deckState?.burnCard) cardBag.push(deckState.burnCard as CardId);
    for (const h of handRows) {
      cardBag.push(...((h.cards ?? []) as CardId[]));
    }
    const inferredVariants = inferVariantConfigFromCards(cardBag);

    // プレイヤー状態をリセット（脱落/守護を解除）
    await tx
      .update(players)
      .set({ isEliminated: false, shield: false, lastActiveAt: new Date() })
      .where(eq(players.roomId, roomId));

    // 既存ゲームを削除（hands/actions/logs は CASCADE）
    await tx.delete(games).where(eq(games.id, existingGame.id));

    const resetPlayers = orderedPlayers.map((p) => ({ ...p, isEliminated: false, shield: false }));
    const setup = await setupNewGame(tx, roomId, resetPlayers, inferredVariants, undefined, {
      round: nextRound,
    });

    await tx
      .update(rooms)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(rooms.id, roomId));

    return { gameId: setup.game.id } as const;
  });

  // SSE購読者へ即時通知（waiting→active の体感ラグを短縮）
  invalidateStateCache(roomId);

  return result;
}


export async function fetchGameState(
  roomId: string,
  playerId?: string,
): Promise<PollingResponse> {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.roomId, roomId));

  if (!game) {
    return {
      state: null,
      etag: `room:${roomId}:empty`,
      lastUpdated: null,
    };
  }

  const allPlayers = await db
    .select()
    .from(players)
    .where(eq(players.roomId, roomId))
    .orderBy(players.seat);

  const handRows = await db
    .select()
    .from(hands)
    .where(eq(hands.gameId, game.id));

  const actionRows = await db
    .select()
    .from(actions)
    .where(eq(actions.gameId, game.id))
    .orderBy(actions.createdAt);

  const logRows = await db
    .select()
    .from(logs)
    .where(eq(logs.gameId, game.id))
    .orderBy(desc(logs.createdAt))
    .limit(MAX_LOGS);

  const clientState = mapToClientState(
    game,
    allPlayers,
    handRows,
    actionRows,
    logRows,
    playerId,
  );

  // より効率的なETag生成：ゲーム状態の主要な変化を反映
  // updatedAt + 最新ログ + フェーズ + ターン + プレイヤー数（状態変化をより正確に反映）
  const latestLog = logRows[0];
  const latestAction = actionRows[actionRows.length - 1];
  const etagSnapshot = {
    gameUpdatedAt: game.updatedAt.toISOString(),
    latestLog: latestLog ? { id: latestLog.id, createdAt: latestLog.createdAt.toISOString() } : null,
    latestAction: latestAction ? { id: latestAction.id, createdAt: latestAction.createdAt.toISOString() } : null,
    phase: game.phase,
    turnIndex: game.turnIndex,
    round: game.round,
    activePlayerId: game.activePlayerId,
    playerId: playerId ?? null,
    players: allPlayers.filter((p) => p.role === "player").map((p) => ({
      id: p.id,
      isEliminated: p.isEliminated,
      shield: p.shield,
      lastActiveAt: p.lastActiveAt?.toISOString() ?? null,
    })),
    hands: handRows.map((h) => ({
      playerId: h.playerId,
      updatedAt: h.updatedAt.toISOString(),
      cardsLength: h.cards.length,
    })),
  };
  const etag = `"${createHash("sha256").update(JSON.stringify(etagSnapshot)).digest("hex").slice(0, 32)}"`;

  return {
    state: clientState,
    etag,
    lastUpdated: game.updatedAt.toISOString(),
  };
}

export async function handleGameAction(
  action: GameActionRequest,
): Promise<GameActionResult> {
  if (action.type !== "play_card" && action.type !== "resign") {
    return { success: false, message: "未対応のアクションです。" };
  }

  if (action.type === "resign") {
    return handleResign(action.playerId, action.roomId);
  }

  return handlePlayCard(action);
}

async function handleResign(playerId: string, roomId: string) {
  let runBotAfterCommit = false;

  const result = await db.transaction(async (tx) => {
    await tx
      .update(players)
      .set({ isEliminated: true, lastActiveAt: new Date() })
      .where(eq(players.id, playerId));

    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.roomId, roomId))
      .for("update");

    if (!game) {
      return { success: true };
    }

    const playersInRoom = await tx
      .select()
      .from(players)
      .where(eq(players.roomId, roomId))
      .orderBy(players.seat)
      .for("update");

    const survivors = playersInRoom.filter((p) => !p.isEliminated && p.role === "player");

    if (survivors.length <= 1) {
      await concludeRound(tx, game, survivors.map((p) => p.id), "resign");
      return { success: true };
    }

    const activePlayer = playersInRoom.find((p) => p.id === game.activePlayerId);
    const activeEliminated = !activePlayer || activePlayer.isEliminated;

    if (activeEliminated || !game.activePlayerId) {
      await advanceTurn(tx, game, playersInRoom);

      const [nextGame] = await tx
        .select()
        .from(games)
        .where(eq(games.id, game.id));

      if (nextGame?.activePlayerId && nextGame.phase === "choose_card") {
        const nextPlayer = playersInRoom.find((p) => p.id === nextGame.activePlayerId);
        if (nextPlayer?.isBot && !nextPlayer.isEliminated) {
          runBotAfterCommit = true;
        }
      }
    }
    await tx.update(games).set({ updatedAt: new Date() }).where(eq(games.id, game.id));

    return { success: true };
  });

  if (result.success) {
    invalidateStateCache(roomId);
    if (runBotAfterCommit) {
      executeBotTurn(roomId).catch((error) => {
        console.error("bot turn error after resign", error);
      });
    }
  }

  return result;
}



async function setupNewGame(
  tx: TransactionClient,
  roomId: string,
  playerRows: typeof players.$inferSelect[],
  variants?: VariantConfig,
  overrides?: TestDeckOverrides,
  options?: { round?: number },
) {
  const envOverrides = getTestDeckOverrides() ?? undefined;
  const ov = overrides ?? envOverrides;
  const round = options?.round ?? 1;

  let deck: CardId[];
  if (ov?.fixedDeck && ov.fixedDeck.length > 0) {
    deck = [...ov.fixedDeck];
  } else {
    const seed = ov?.seed ?? randomUUID();
    deck = shuffleDeck(buildFullDeck(variants), seed);
  }

  const { card: burnCard, deck: deckAfterBurn } = draw(deck);

  const revealed: CardId[] = [];
  let workingDeck = deckAfterBurn;
  if (playerRows.length === 2) {
    for (let i = 0; i < 3; i += 1) {
      const drawResult = draw(workingDeck);
      if (drawResult.card) {
        revealed.push(drawResult.card);
      }
      workingDeck = drawResult.deck;
    }
  }

  const handsToInsert: { playerId: string; cards: CardId[] }[] = [];
  for (const player of playerRows) {
    const drawResult = draw(workingDeck);
    if (!drawResult.card) {
      throw new Error("山札生成に失敗しました。");
    }
    workingDeck = drawResult.deck;
    handsToInsert.push({ playerId: player.id, cards: [drawResult.card] });
  }

  const [game] = await tx
    .insert(games)
    .values({
      roomId,
      round,
      phase: "draw",
      turnIndex: 0,
      deckState: { drawPile: workingDeck, burnCard: burnCard ?? null },
      discardPile: [],
      revealedSetupCards: revealed,
      activePlayerId: playerRows[0]?.id,
    })
    .returning();

  await tx.insert(hands).values(
    handsToInsert.map((h) => ({
      gameId: game.id,
      playerId: h.playerId,
      cards: h.cards,
    })),
  );

  await beginTurn(tx, game, playerRows[0]);

  return { game };
}

function randomAvatarSeed() {
  return Math.random().toString(36).substring(2, 10);
}


function buildVariantConfigFromIds(ids: CardId[]): VariantConfig {
  const config: VariantConfig = {};
  for (const id of ids) {
    const def = CARD_DEFINITIONS[id];
    if (!def || !isSupportedVariantCardId(id)) continue;
    const r = def.rank;
    if (r >= 1 && r <= 7 && config[r as 1 | 2 | 3 | 4 | 5 | 6 | 7] === undefined) {
      config[r as 1 | 2 | 3 | 4 | 5 | 6 | 7] = id;
    }
  }
  return config;
}


export { executeBotTurn } from "@/lib/server/game/bot-turn-service";
