import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db, type DbClient } from "@/lib/db/client";
import { buildFullDeck, draw, shuffleDeck } from "@/lib/game/deck";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type {
  CardId,
  ClientGameState,
  GameActionRequest,
  GameActionResult,
  PlayerId,
  PollingResponse,
} from "@/lib/game/types";
import { invalidateStateCache } from "@/lib/server/game-state-cache";
import {
  actions,
  games,
  hands,
  logs,
  playerRoleEnum,
  players,
  rooms,
} from "@/drizzle/schema";

type DeckState = { drawPile: CardId[]; burnCard: CardId | null };

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

export async function createRoomWithBot(nickname: string) {
  return db.transaction(async (tx) => {
    const [room] = await tx
      .insert(rooms)
      .values({})
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

    const setup = await setupNewGame(tx, room.id, [host, ...botRows].sort((a, b) => a.seat - b.seat));

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
  const result = await db.transaction(async (tx) => {
    await tx
      .update(players)
      .set({ isEliminated: true })
      .where(eq(players.id, playerId));

    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.roomId, roomId));

    if (!game) {
      return { success: true };
    }

    const allPlayers = await tx
      .select()
      .from(players)
      .where(eq(players.roomId, roomId))
      .orderBy(players.seat);

    const survivors = allPlayers.filter((p) => !p.isEliminated && p.role === "player");

    if (survivors.length <= 1) {
      await concludeRound(tx, game, survivors.map((p) => p.id), "resign");
    }

    return { success: true };
  });

  if (result.success) {
    invalidateStateCache(roomId);
  }

  return result;
}

async function handlePlayCard(action: GameActionRequest): Promise<GameActionResult> {
  const { cardId, targetId, guessedRank } = action.payload ?? {};

  if (!cardId) {
    return { success: false, message: "cardId が必要です。" };
  }

  const { success, runBotAfterCommit } = await db.transaction(async (tx) => {
    let runBotAfterCommit = false;

    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, action.gameId));

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
      .orderBy(players.seat);

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
      .where(and(eq(hands.gameId, game.id), eq(hands.playerId, action.playerId)));

    const currentHand = handRow[0];
    if (!currentHand) {
      return { success: false, message: "手札情報が見つかりません。" };
    }

    const cardIndex = currentHand.cards.findIndex((c) => c === cardId);
    if (cardIndex < 0) {
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

    const holdsVizier = currentHand.cards.includes("vizier");
    const forcedDiscardCards: CardId[] = ["arbiter", "legate"];
    if (
      holdsVizier &&
      cardId !== "vizier" &&
      forcedDiscardCards.includes(cardId) &&
      currentHand.cards.includes("vizier")
    ) {
      return {
        success: false,
        message: "Vizier を同時に所持しているため、このカードは使用できません。Vizier を捨ててください。",
      };
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

    const noEffectMessage =
      requiresTargetSelection && !hasSelectableTarget
        ? "。しかし有効な対象が存在しないため効果は発動しませんでした。"
        : "";

    switch (definition.effectType) {
      case "guess_eliminate":
        if (!hasSelectableTarget || !targetPlayer || guessedRank === undefined) {
          logMessage += noEffectMessage || "。推測できる対象がいません。";
        } else {
          const targetHandRow = await getHand(tx, game.id, targetPlayer.id);
          if (!targetHandRow || targetHandRow.cards.length === 0) {
            logMessage += "。相手の手札が存在せず効果は発動しませんでした。";
            break;
          }
          const targetCard = targetHandRow.cards[0] as CardId;
          const targetRank = CARD_DEFINITIONS[targetCard].rank;
          if (targetRank === guessedRank) {
            eliminationQueue = [targetPlayer.id];
            logMessage += `。推測が命中し、${targetPlayer.nickname} は脱落しました。`;
          } else {
            logMessage += "。推測は外れました。";
          }
          await tx
            .insert(actions)
            .values({
              gameId: game.id,
              actorId: actingPlayer.id,
              type: "guess",
              payload: { targetId, guessedRank },
            });
        }
        break;
      case "peek":
        if (!hasSelectableTarget || !targetPlayer) {
          logMessage += noEffectMessage || "。対象がいないため効果は発動しませんでした。";
        } else {
          logMessage += `。${targetPlayer.nickname} の手札を覗き見ました。`;
          await tx
            .insert(actions)
            .values({
              gameId: game.id,
              actorId: actingPlayer.id,
              type: "peek",
              payload: { targetId },
            });
        }
        break;
      case "compare":
        if (!hasSelectableTarget || !targetPlayer) {
          logMessage += noEffectMessage || "。比較対象がいないため効果は発動しませんでした。";
        } else {
          await tx
            .insert(actions)
            .values({
              gameId: game.id,
              actorId: actingPlayer.id,
              type: "compare",
              payload: { targetId },
            });
          logMessage += `。${targetPlayer.nickname} と手札を比較しました。`;
          eliminationQueue = await resolveCompare(tx, game.id, actingPlayer.id, targetPlayer.id);
        }
        break;
      case "shield":
        await tx
          .update(players)
          .set({ shield: true })
          .where(eq(players.id, actingPlayer.id));
        logMessage += "。守護状態になりました。";
        break;
      case "force_discard":
        if (!hasSelectableTarget || !targetPlayer) {
          logMessage += noEffectMessage || "。対象がいないため効果は発動しませんでした。";
        } else {
          const discardResult = await resolveForceDiscard(
            tx,
            game,
            deckState,
            targetPlayer.id,
          );
          deckState = discardResult.deckState;
          if (discardResult.eliminated) {
            eliminationQueue.push(targetPlayer.id);
          }
          if (discardResult.discardedCard) {
            discardPile.push(discardResult.discardedCard);
          }
          logMessage += `。${targetPlayer.nickname} の手札を捨てさせました。`;
        }
        break;
      case "swap_hands":
        if (!hasSelectableTarget || !targetPlayer) {
          logMessage += noEffectMessage || "。対象がいないため効果は発動しませんでした。";
        } else {
          await swapHands(tx, game.id, actingPlayer.id, targetPlayer.id);
          logMessage += `。${targetPlayer.nickname} と手札を交換しました。`;
        }
        break;
      case "conditional_discard":
        logMessage += "。静かに捨てられました。";
        break;
      case "self_eliminate":
        eliminationQueue = [actingPlayer.id];
        logMessage += "。照耀の重責により自滅しました。";
        break;
      default:
        break;
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
) {
  const seed = randomUUID();
  const deck = shuffleDeck(buildFullDeck(), seed);

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

async function beginTurn(
  tx: TransactionClient,
  gameRow: typeof games.$inferSelect,
  player: typeof players.$inferSelect,
) {
  const deckState = gameRow.deckState as DeckState;
  let workingDeck = [...deckState.drawPile];

  const hand = await getHand(tx, gameRow.id, player.id);
  if (!hand) {
    return;
  }

  if (!player.isEliminated) {
    const drawResult = draw(workingDeck);
    workingDeck = drawResult.deck;
    if (drawResult.card) {
      await tx
        .update(hands)
        .set({ cards: [...hand.cards, drawResult.card], updatedAt: new Date() })
        .where(eq(hands.id, hand.id));
    }
  }

  await tx
    .update(players)
    .set({ shield: false, lastActiveAt: new Date() })
    .where(eq(players.id, player.id));

  await tx
    .update(games)
    .set({
      phase: "choose_card",
      activePlayerId: player.id,
      turnIndex: player.seat,
      deckState: { ...deckState, drawPile: workingDeck },
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameRow.id));
}

async function advanceTurn(
  tx: TransactionClient,
  gameRow: typeof games.$inferSelect,
  playerRows: typeof players.$inferSelect[],
) {
  const orderedPlayers = playerRows
    .filter((p) => p.role === "player")
    .sort((a, b) => a.seat - b.seat);

  const currentIndex = orderedPlayers.findIndex((p) => p.id === gameRow.activePlayerId);
  let nextIndex = (currentIndex + 1) % orderedPlayers.length;

  for (let i = 0; i < orderedPlayers.length; i += 1) {
    const candidate = orderedPlayers[(currentIndex + 1 + i) % orderedPlayers.length];
    if (!candidate.isEliminated) {
      nextIndex = (currentIndex + 1 + i) % orderedPlayers.length;
      break;
    }
  }

  const nextPlayer = orderedPlayers[nextIndex];
  if (!nextPlayer) {
    return;
  }

  const [freshGame] = await tx
    .select()
    .from(games)
    .where(eq(games.id, gameRow.id));

  await beginTurn(tx, freshGame, nextPlayer);
}

async function executeBotTurn(roomId: string) {
  const botAction = await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.roomId, roomId));

    if (!game || game.phase !== "choose_card" || !game.activePlayerId) {
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

    const cardToPlay = chooseBotCard(hand.cards as CardId[]);
    const definition = CARD_DEFINITIONS[cardToPlay];

    const roomPlayers = await tx
      .select()
      .from(players)
      .where(and(eq(players.roomId, roomId), eq(players.role, "player" as PlayerRole)));

    // Build target according to card target rules
    let chosenTarget: typeof players.$inferSelect | undefined;
    if (definition.target === "self") {
      chosenTarget = roomPlayers.find((p) => p.id === botPlayer.id);
    } else if (definition.target === "opponent") {
      const candidates = roomPlayers.filter(
        (p) => p.id !== botPlayer.id && !p.isEliminated && (!definition.cannotTargetShielded || !p.shield),
      );
      chosenTarget = candidates[0];
    } else if (definition.target === "any") {
      const candidates = roomPlayers.filter((p) => {
        if (p.isEliminated) return false;
        if (p.id === botPlayer.id) return true; // self is allowed for "any"
        return !definition.cannotTargetShielded || !p.shield;
      });
      chosenTarget = candidates[0];
    }

    return {
      gameId: game.id,
      roomId,
      playerId: game.activePlayerId,
      type: "play_card" as const,
      payload: {
        cardId: cardToPlay,
        targetId: chosenTarget?.id,
        guessedRank:
          definition.requiresGuess ? chooseBotGuess(chosenTarget ?? null) : undefined,
      },
    } satisfies GameActionRequest;
  });

  if (botAction) {
    await handlePlayCard(botAction);
  }
}

function chooseBotCard(cards: CardId[]): CardId {
  if (cards.includes("vizier") && cards.some((card) => card === "arbiter" || card === "legate")) {
    return "vizier";
  }
  const sorted = [...cards].sort((a, b) => CARD_DEFINITIONS[a].rank - CARD_DEFINITIONS[b].rank);
  return sorted[0];
}

function chooseBotGuess(target?: typeof players.$inferSelect | null) {
  if (!target) return 2;
  const ranks = Object.values(CARD_DEFINITIONS)
    .filter((card) => card.rank > 1)
    .map((card) => card.rank);
  return ranks[Math.floor(Math.random() * ranks.length)];
}

async function determineWinnersByHand(
  tx: TransactionClient,
  gameId: string,
  survivors: typeof players.$inferSelect[],
) {
  const handRows = await tx
    .select()
    .from(hands)
    .where(
      and(eq(hands.gameId, gameId), inArray(hands.playerId, survivors.map((p) => p.id))),
    );

  let maxRank = -1;
  let winners: string[] = [];

  for (const player of survivors) {
    const hand = handRows.find((h) => h.playerId === player.id);
    if (!hand || hand.cards.length === 0) continue;
    const highest = Math.max(
      ...hand.cards.map((card) => CARD_DEFINITIONS[card as CardId].rank),
    );
    if (highest > maxRank) {
      maxRank = highest;
      winners = [player.id];
    } else if (highest === maxRank) {
      winners.push(player.id);
    }
  }

  return winners;
}

async function concludeRound(
  tx: TransactionClient,
  game: typeof games.$inferSelect,
  winnerIds: string[],
  reason: string,
) {
  await tx
    .update(games)
    .set({
      phase: "finished",
      result: { winnerIds, reason },
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  await tx
    .update(rooms)
    .set({ status: "finished", updatedAt: new Date() })
    .where(eq(rooms.id, game.roomId));

  const winners = await tx
    .select({ id: players.id, nickname: players.nickname })
    .from(players)
    .where(inArray(players.id, winnerIds));

  const message =
    winners.length > 0
      ? `${winners.map((w) => w.nickname).join(" / ")} が勝利しました。`
      : "このラウンドは引き分けです。";

  await tx
    .insert(logs)
    .values({
      gameId: game.id,
      message,
      icon: "crown",
    });

  // ルームは即時削除せず、クリーンアップジョブで一定時間後に処理する
}

async function eliminatePlayers(tx: TransactionClient, playerIds: string[]) {
  if (playerIds.length === 0) return;
  await tx
    .update(players)
    .set({ isEliminated: true })
    .where(inArray(players.id, playerIds));
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

async function resolveForceDiscard(
  tx: TransactionClient,
  game: typeof games.$inferSelect,
  deckState: DeckState,
  targetId: string,
) {
  const hand = await getHand(tx, game.id, targetId);
  if (!hand || hand.cards.length === 0) {
    return { deckState, eliminated: false, discardedCard: null as CardId | null };
  }

  const discarded = hand.cards[0] as CardId;
  const remaining = hand.cards.slice(1);

  await tx
    .update(hands)
    .set({ cards: remaining, updatedAt: new Date() })
    .where(eq(hands.id, hand.id));

  const nextDraw = draw(deckState.drawPile);
  const newDeckState: DeckState = {
    drawPile: nextDraw.deck,
    burnCard: deckState.burnCard,
  };

  if (nextDraw.card) {
    await tx
      .update(hands)
      .set({ cards: [...remaining, nextDraw.card], updatedAt: new Date() })
      .where(eq(hands.id, hand.id));
  }

  const eliminated = discarded === "emissary";

  return { deckState: newDeckState, eliminated, discardedCard: discarded };
}

async function swapHands(
  tx: TransactionClient,
  gameId: string,
  playerA: string,
  playerB: string,
) {
  const [handA, handB] = await Promise.all([
    getHand(tx, gameId, playerA),
    getHand(tx, gameId, playerB),
  ]);

  if (!handA || !handB) return;

  await Promise.all([
    tx
      .update(hands)
      .set({ cards: handB.cards, updatedAt: new Date() })
      .where(eq(hands.id, handA.id)),
    tx
      .update(hands)
      .set({ cards: handA.cards, updatedAt: new Date() })
      .where(eq(hands.id, handB.id)),
  ]);
}

async function getHand(tx: TransactionClient, gameId: string, playerId: string) {
  const rows = await tx
    .select()
    .from(hands)
    .where(and(eq(hands.gameId, gameId), eq(hands.playerId, playerId)));
  return rows[0] ?? null;
}

function mapToClientState(
  game: typeof games.$inferSelect,
  playerRows: typeof players.$inferSelect[],
  handRows: typeof hands.$inferSelect[],
  actionRows: typeof actions.$inferSelect[],
  logRows: typeof logs.$inferSelect[],
  perspectivePlayerId?: string,
): ClientGameState {
  const drawPile = (game.deckState as DeckState).drawPile;

  const discardMap = new Map<string, CardId[]>();
  for (const action of actionRows) {
    if (action.type === "play_card" && action.actorId) {
      const payload = action.payload as { cardId?: CardId } | null;
      const playedCard = payload?.cardId;
      if (playedCard) {
        const list = discardMap.get(action.actorId) ?? [];
        list.push(playedCard);
        discardMap.set(action.actorId, list);
      }
    }
  }

  const playerStates = playerRows
    .filter((p) => p.role === "player")
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      seat: p.seat,
      shield: p.shield,
      isEliminated: p.isEliminated,
      isBot: p.isBot,
      discardPile: discardMap.get(p.id) ?? [],
      handCount: handRows.find((h) => h.playerId === p.id)?.cards.length ?? 0,
      lastActiveAt: p.lastActiveAt?.toISOString?.() ?? new Date().toISOString(),
    }));

  const logsMapped = logRows
    .slice()
    .reverse()
    .map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      message: log.message,
      actorId: log.actorId ?? undefined,
      icon: (log.icon as ClientGameState["logs"][number]["icon"]) ?? "info",
    }));

  const base: ClientGameState = {
    id: game.id,
    roomId: game.roomId,
    phase: game.phase,
    turnIndex: game.turnIndex,
    round: game.round,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    drawPileCount: drawPile.length,
    discardPile: game.discardPile as CardId[],
    revealedSetupCards: game.revealedSetupCards as CardId[],
    topDiscard: (game.discardPile as CardId[]).slice(-1)[0],
    players: playerStates,
    activePlayerId: game.activePlayerId ?? undefined,
    awaitingPlayerId: game.awaitingPlayerId ?? undefined,
    logs: logsMapped,
    self: undefined,
    hand: undefined,
    result: (game.result ?? undefined) as ClientGameState["result"],
  };

  if (perspectivePlayerId) {
    const hand = handRows.find((h) => h.playerId === perspectivePlayerId);
    const playerInfo = playerRows.find((p) => p.id === perspectivePlayerId);
    if (hand && playerInfo) {
      base.self = {
        id: playerInfo.id,
        nickname: playerInfo.nickname,
        seat: playerInfo.seat,
        isBot: playerInfo.isBot,
        shield: playerInfo.shield,
        isEliminated: playerInfo.isEliminated,
        discardPile: discardMap.get(playerInfo.id) ?? [],
        handCount: hand.cards.length,
        lastActiveAt: playerInfo.lastActiveAt?.toISOString?.() ?? new Date().toISOString(),
        hand: hand.cards as CardId[],
      } as ClientGameState["self"];
      base.hand = hand.cards as CardId[];
    }

    // effectHints: actor専用の一時的な可視化ヒント（例: peekで相手手札を短時間表示）
    // 最新のpeekアクションのうち、視点プレイヤーが実行者のものを検出
    const lastPeek = actionRows
      .slice()
      .reverse()
      .find((a) => a.type === "peek" && a.actorId === perspectivePlayerId);
    if (lastPeek) {
      const payload = (lastPeek.payload ?? {}) as { targetId?: string };
      const targetId = payload.targetId;
      if (targetId) {
        const targetHandRow = handRows.find((h) => h.playerId === targetId);
        const targetTop = targetHandRow?.cards?.[0] as CardId | undefined;
        if (targetTop) {
          base.effectHints = {
            ...(base.effectHints ?? {}),
            peek: {
              actionId: lastPeek.id,
              targetId,
              card: targetTop,
            },
          };
        }
      }
    }
  }

  // 公開してよい最終アクション（機密値は含めない）
  if (actionRows.length > 0) {
    const a = actionRows[actionRows.length - 1]!;
    const payload = (a.payload ?? {}) as { targetId?: string };
    base.lastAction = {
      id: a.id,
      type: a.type,
      actorId: a.actorId,
      targetId: payload.targetId,
    };
  }

  return base;
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

