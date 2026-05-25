import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db, type DbClient } from "@/lib/db/client";
import { buildFullDeck, draw, shuffleDeck, getTestDeckOverrides, type TestDeckOverrides } from "@/lib/game/deck";
import { CARD_POOL } from "@/lib/game/cards";
import type { VariantConfig } from "@/lib/game/variants";
import { isSupportedVariantCardId } from "@/lib/game/variant-support";
import { generateOpaqueToken, hashToken } from "@/lib/server/auth";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { getForcedPlayableCard } from "@/lib/game/forced-card-rules";
import { chooseBotAction, chooseBotCard } from "@/lib/server/bot-service";
import { resolveCardEffect, type RulesPlayerSnapshot } from "@/lib/game/rules/card-effect-engine";
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
import { getHand, resolveForceDiscard, swapHands, type DeckState } from "@/lib/server/game/hand-service";
import { mapToClientState } from "@/lib/server/game/state-mapper";
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
      const code = (error as any)?.code as string | undefined;
      const message = (error as any)?.message as string | undefined;
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
    const expectedHostId = (room as any).hostPlayerId ?? playerRows.find((p) => p.seat === 0)?.id ?? null;
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
  const stateVersion = [
    game.updatedAt.getTime(),
    logRows[0]?.createdAt.getTime() ?? 0,
    game.phase,
    game.turnIndex,
    game.round,
    allPlayers.length,
    playerId ?? 'common', // プレイヤー固有の状態も考慮
  ].join(':');
  
  // 簡易ハッシュ（長い文字列を短縮）
  const etag = `"${Buffer.from(stateVersion).toString('base64').slice(0, 32)}"`;

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
      .set({ isEliminated: true })
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

async function handlePlayCard(action: GameActionRequest): Promise<GameActionResult> {
  const { cardId, targetId, guessedRank } = action.payload ?? {};

  if (!cardId) {
    return { success: false, message: "cardId が必要です。" };
  }

  let success = false as boolean;
  let runBotAfterCommit = false as boolean;
  try {
    const txResult = await db.transaction(async (tx) => {
      let runBotAfterCommit = false;

    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, action.gameId))
      .for("update");

    if (!game) {
      return { success: false, message: "ゲームが存在しません。" };
    }

    if (game.phase !== "choose_card") {
      return { success: false, message: "カードを使用できるフェーズではありません。" };
    }

    if (game.activePlayerId !== action.playerId) {
      return { success: false, message: "あなたの手番ではありません。" };
    }

    const playersInRoom = await tx
      .select()
      .from(players)
      .where(eq(players.roomId, action.roomId))
      .orderBy(players.seat)
      .for("update");

    const actingPlayer = playersInRoom.find((p) => p.id === action.playerId);
    if (!actingPlayer || actingPlayer.isEliminated) {
      return { success: false, message: "プレイヤー状態が不正です。" };
    }

    const targetPlayer = targetId
      ? playersInRoom.find((p) => p.id === targetId)
      : undefined;

    const handRow = await tx
      .select()
      .from(hands)
      .where(and(eq(hands.gameId, game.id), eq(hands.playerId, action.playerId)))
      .for("update");

    const currentHand = handRow[0];
    if (!currentHand) {
      return { success: false, message: "手札情報が見つかりません。" };
    }

    let cardIndex = currentHand.cards.findIndex((c) => c === cardId);
    if (cardIndex < 0) {
      // 冪等ガード: 直近の同一内容の play_card が既に処理済みなら成功として返す
      const [lastAction] = await tx
        .select()
        .from(actions)
        .where(eq(actions.gameId, game.id))
        .orderBy(desc(actions.createdAt))
        .limit(1);
      const lastPayload = (lastAction?.payload ?? {}) as {
        cardId?: CardId;
        targetId?: string | null;
        guessedRank?: number | null;
      };
      const sameActor = lastAction?.actorId === action.playerId;
      const sameType = lastAction?.type === "play_card";
      const sameCard = lastPayload.cardId === cardId;
      const sameTarget = (lastPayload.targetId ?? undefined) === (targetId ?? undefined);
      const sameGuess = (lastPayload.guessedRank ?? undefined) === (guessedRank ?? undefined);
      if (sameActor && sameType && sameCard && sameTarget && sameGuess) {
        return { success: true } as const;
      }
      return { success: false, message: "指定カードが手札にありません。" };
    }

    const definition = CARD_DEFINITIONS[cardId];
    if (!definition) {
      return { success: false, message: "未知のカードです。" };
    }

    const candidatePlayers = playersInRoom.filter((p) => p.role === "player");
    const requiresTargetSelection = definition.target === "opponent" || definition.target === "any";

    const selectablePlayers = candidatePlayers.filter((p) => {
      if (p.id === actingPlayer.id && definition.target === "opponent") return false;
      if (definition.target === "self" && p.id !== actingPlayer.id) return false;
      if ((definition.target === "opponent" || definition.target === "any") && p.isEliminated) return false;
      if (definition.cannotTargetShielded && p.shield && p.id !== actingPlayer.id) return false;
      return true;
    });

    const hasSelectableTarget = requiresTargetSelection && selectablePlayers.length > 0;

    if (definition.requiresGuess && hasSelectableTarget && (guessedRank === undefined || guessedRank === 1)) {
      return { success: false, message: "有効な推測値を入力してください。" };
    }

    if (requiresTargetSelection && hasSelectableTarget) {
      if (!targetPlayer) {
        return { success: false, message: "対象プレイヤーを選択してください。" };
      }
      const isSelectable = selectablePlayers.some((p) => p.id === targetPlayer.id);
      if (!isSelectable) {
        return { success: false, message: "選択したプレイヤーを対象にできません。" };
      }
    }

    if (targetPlayer?.shield && definition.cannotTargetShielded) {
      return { success: false, message: "対象は守護状態です。" };
    }

    const forcedCard = getForcedPlayableCard(currentHand.cards as CardId[]);
    if (forcedCard && cardId !== forcedCard) {
      const message =
        forcedCard === "vizier"
          ? "Vizier を同時に所持しているため、このカードは使用できません。Vizier を捨ててください。"
          : "手札合計が12以上のため、Marquise を先に使用する必要があります。";
      return { success: false, message };
    }

    const updatedHand = [...currentHand.cards];
    updatedHand.splice(cardIndex, 1);

    await tx
      .update(hands)
      .set({ cards: updatedHand, updatedAt: new Date() })
      .where(eq(hands.id, currentHand.id));

    const discardPile = [...(game.discardPile as CardId[]), cardId];

    let deckState = game.deckState as DeckState;
    let eliminationQueue: PlayerId[] = [];
    let logMessage = `${actingPlayer.nickname} が ${definition.name} を使用`;
    let effectActivated = false; // エフェクトが実際に発動したかどうかを追跡

    await tx
      .insert(actions)
      .values({
        gameId: game.id,
        actorId: actingPlayer.id,
        type: "play_card",
        payload: {
          cardId,
          targetId: targetPlayer?.id ?? null,
          guessedRank: guessedRank ?? null,
        },
      });

    const rulesPlayers: RulesPlayerSnapshot[] = await Promise.all(
      candidatePlayers.map(async (p) => {
        const handRow = await getHand(tx, game.id, p.id);
        return {
          id: p.id,
          nickname: p.nickname,
          isSelf: p.id === actingPlayer.id,
          isEliminated: p.isEliminated,
          shield: p.shield,
          hand: (handRow?.cards ?? []) as CardId[],
        };
      }),
    );

    const effectResult = resolveCardEffect({
      actorId: actingPlayer.id,
      actorNickname: actingPlayer.nickname,
      cardId,
      actorHandAfterPlay: updatedHand as CardId[],
      targetId: targetPlayer?.id,
      guessedRank,
      players: rulesPlayers,
      drawPileCount: deckState.drawPile.length,
    });

    if (!effectResult.ok) {
      return { success: false, message: effectResult.message ?? "カード効果の解決に失敗しました。" };
    }

    effectActivated = effectResult.effectActivated;
    logMessage += effectResult.logSuffix;
    eliminationQueue.push(...effectResult.eliminatedPlayerIds);

    for (const instruction of effectResult.instructions) {
      switch (instruction.type) {
        case "insert_action":
          if (instruction.actionType === "force_discard") {
            break;
          }
          await tx.insert(actions).values({
            gameId: game.id,
            actorId: actingPlayer.id,
            type: instruction.actionType,
            payload: instruction.payload,
          });
          break;
        case "set_shield":
          await tx.update(players).set({ shield: true }).where(eq(players.id, instruction.playerId));
          break;
        case "swap_hands":
          await swapHands(tx, game.id, instruction.playerA, instruction.playerB);
          break;
        case "force_discard": {
          const discardResult = await resolveForceDiscard(tx, game, deckState, instruction.targetId);
          deckState = discardResult.deckState;
          if (discardResult.eliminated) {
            eliminationQueue.push(instruction.targetId);
          }
          if (discardResult.discardedCard) {
            discardPile.push(discardResult.discardedCard);
            await tx.insert(actions).values({
              gameId: game.id,
              actorId: actingPlayer.id,
              type: "force_discard",
              payload: { targetId: instruction.targetId, cardId: discardResult.discardedCard },
            });
          }
          break;
        }
      }
    }

    await tx
      .update(games)
      .set({
        discardPile,
        deckState,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    await tx
      .insert(logs)
      .values({
        gameId: game.id,
        actorId: actingPlayer.id,
        message: logMessage,
        icon: definition.icon,
      });

    if (eliminationQueue.length > 0) {
      await eliminatePlayers(tx, eliminationQueue);
    }

    const postPlayers = await tx
      .select()
      .from(players)
      .where(eq(players.roomId, action.roomId))
      .orderBy(players.seat);

    const survivors = postPlayers.filter((p) => !p.isEliminated && p.role === "player");

    if (survivors.length <= 1) {
      await concludeRound(tx, game, survivors.map((p) => p.id), "elimination");
      return { success: true };
    }

    if (deckState.drawPile.length === 0) {
      const winnerIds = await determineWinnersByHand(tx, game.id, survivors);
      await concludeRound(tx, game, winnerIds, "deck_exhausted");
      return { success: true };
    }

    await advanceTurn(tx, game, postPlayers);

    const [nextGame] = await tx
      .select()
      .from(games)
      .where(eq(games.id, game.id));

    if (nextGame?.activePlayerId && nextGame.phase === "choose_card") {
      const nextPlayer = postPlayers.find((p) => p.id === nextGame.activePlayerId);
      if (nextPlayer?.isBot && !nextPlayer.isEliminated) {
        runBotAfterCommit = true;
      }
    }

      return { success: true, runBotAfterCommit } as const;
    });
    success = !!txResult.success;
    runBotAfterCommit = !!(txResult as { runBotAfterCommit?: boolean }).runBotAfterCommit;
    
  } catch (error) {
    console.error("[handlePlayCard] transaction failed", error);
    return { success: false, message: "カード処理中にエラーが発生しました。" };
  }

  if (success) {
    invalidateStateCache(action.roomId);
  }

  if (runBotAfterCommit) {
    executeBotTurn(action.roomId).catch((error) => {
      console.error("bot turn error", error);
    });
  }

  return { success };
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

const BOT_FALLBACK_THINK_TIME_MS = 2500; // fallback think time when no client-side trigger is available
const BOT_THINK_JITTER_RATIO = 0.4; // +/-20% around base (0.8x - 1.2x)

export async function executeBotTurn(
  roomId: string,
  options?: { skipThinkDelay?: boolean },
) {
  let delayedTurnSnapshot:
    | { gameId: string; activePlayerId: string; turnIndex: number }
    | null = null;

  if (!options?.skipThinkDelay) {
    const [beforeDelayGame] = await db
      .select({
        id: games.id,
        activePlayerId: games.activePlayerId,
        turnIndex: games.turnIndex,
        phase: games.phase,
      })
      .from(games)
      .where(eq(games.roomId, roomId));

    if (!beforeDelayGame || beforeDelayGame.phase !== "choose_card" || !beforeDelayGame.activePlayerId) {
      return;
    }

    delayedTurnSnapshot = {
      gameId: beforeDelayGame.id,
      activePlayerId: beforeDelayGame.activePlayerId,
      turnIndex: beforeDelayGame.turnIndex,
    };

    // Add thinking delay so bot turns are not instantaneous.
    // This path acts as a fallback when client-driven trigger is unavailable.
    const jitterMultiplier = 1 - BOT_THINK_JITTER_RATIO / 2 + Math.random() * BOT_THINK_JITTER_RATIO;
    const thinkDelay = Math.max(0, Math.round(BOT_FALLBACK_THINK_TIME_MS * jitterMultiplier));
    await new Promise<void>((resolve) => setTimeout(resolve, thinkDelay));
  }
  const botAction = await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(
        delayedTurnSnapshot
          ? eq(games.id, delayedTurnSnapshot.gameId)
          : eq(games.roomId, roomId),
      );

    if (!game || game.phase !== "choose_card" || !game.activePlayerId) {
      return null;
    }

    if (
      delayedTurnSnapshot &&
      (game.activePlayerId !== delayedTurnSnapshot.activePlayerId ||
        game.turnIndex !== delayedTurnSnapshot.turnIndex)
    ) {
      return null;
    }

    const botPlayers = await tx
      .select()
      .from(players)
      .where(and(eq(players.id, game.activePlayerId), eq(players.isBot, true)));

    const botPlayer = botPlayers[0];
    if (!botPlayer || botPlayer.isEliminated) {
      return null;
    }

    const hand = await getHand(tx, game.id, game.activePlayerId);
    if (!hand || hand.cards.length === 0) {
      return null;
    }

    const roomPlayers = await tx
      .select()
      .from(players)
      .where(and(eq(players.roomId, roomId), eq(players.role, "player" as PlayerRole)));

    const decision = chooseBotAction({
      selfId: botPlayer.id,
      hand: hand.cards as CardId[],
      players: roomPlayers.map((p) => ({ id: p.id, isEliminated: p.isEliminated, shield: p.shield, handCount: 1, discardPile: [] })),
    });

    return {
      gameId: game.id,
      roomId,
      playerId: game.activePlayerId,
      type: "play_card" as const,
      payload: {
        cardId: decision.cardId,
        targetId: decision.targetId,
        guessedRank: decision.guessedRank,
      },
    } satisfies GameActionRequest;
  });

  if (botAction) {
    await handlePlayCard(botAction);
  }
}

function chooseBotGuess(target?: typeof players.$inferSelect | null) {
  if (!target) return 2;
  const ranks = Object.values(CARD_DEFINITIONS)
    .filter((card) => card.rank > 1)
    .map((card) => card.rank);
  return ranks[Math.floor(Math.random() * ranks.length)];
}

async function resolveCompare(
  tx: TransactionClient,
  gameId: string,
  attackerId: string,
  targetId: string,
) {
  const [attackerHand, targetHand] = await Promise.all([
    getHand(tx, gameId, attackerId),
    getHand(tx, gameId, targetId),
  ]);

  if (!attackerHand || !targetHand) {
    return [] as PlayerId[];
  }

  const attackerMax = Math.max(
    ...attackerHand.cards.map((card) => CARD_DEFINITIONS[card as CardId].rank),
  );
  const targetMax = Math.max(
    ...targetHand.cards.map((card) => CARD_DEFINITIONS[card as CardId].rank),
  );

  if (attackerMax === targetMax) {
    return [];
  }

  return attackerMax > targetMax ? [targetId] : [attackerId];
}

function randomAvatarSeed() {
  return Math.random().toString(36).substring(2, 10);
}

function findNextSeat(taken: number[]) {
  for (let i = 0; i < 4; i += 1) {
    if (!taken.includes(i)) return i;
  }
  return 0;
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

