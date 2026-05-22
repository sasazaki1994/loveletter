import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId, CardEffectType, PlayerId } from "@/lib/game/types";

export type RulesPlayerSnapshot = {
  id: PlayerId;
  nickname: string;
  isSelf: boolean;
  isEliminated: boolean;
  shield: boolean;
  hand: CardId[];
};

export type ResolveCardEffectInput = {
  actorId: PlayerId;
  actorNickname: string;
  cardId: CardId;
  actorHandAfterPlay: CardId[];
  targetId?: PlayerId;
  guessedRank?: number;
  players: RulesPlayerSnapshot[];
  drawPileCount: number;
};

type EffectActionType = "guess" | "peek" | "compare" | "force_discard";

export type CardEffectInstruction =
  | { type: "insert_action"; actionType: EffectActionType; payload: Record<string, unknown> }
  | { type: "set_shield"; playerId: PlayerId }
  | { type: "swap_hands"; playerA: PlayerId; playerB: PlayerId }
  | { type: "force_discard"; targetId: PlayerId };

export type ResolveCardEffectResult = {
  ok: boolean;
  message?: string;
  effectActivated: boolean;
  logSuffix: string;
  eliminatedPlayerIds: PlayerId[];
  instructions: CardEffectInstruction[];
};

function successResult(params: Omit<ResolveCardEffectResult, "ok">): ResolveCardEffectResult {
  return { ok: true, ...params };
}

export function resolveCardEffect(input: ResolveCardEffectInput): ResolveCardEffectResult {
  const definition = CARD_DEFINITIONS[input.cardId];
  const effectType = definition.effectType as CardEffectType;
  const target = input.players.find((p) => p.id === input.targetId);

  const noEffectMessage = "。しかし有効な対象が存在しないため効果は発動しませんでした。";

  switch (effectType) {
    case "guess_eliminate": {
      if (!target || input.guessedRank === undefined) {
        return successResult({
          effectActivated: false,
          logSuffix: noEffectMessage,
          eliminatedPlayerIds: [],
          instructions: [],
        });
      }
      if (target.hand.length === 0) {
        return successResult({
          effectActivated: false,
          logSuffix: "。相手の手札が存在せず効果は発動しませんでした。",
          eliminatedPlayerIds: [],
          instructions: [],
        });
      }
      const targetCard = target.hand[0] as CardId;
      const targetRank = CARD_DEFINITIONS[targetCard].rank;
      const hit = targetRank === input.guessedRank;
      return successResult({
        effectActivated: true,
        logSuffix: hit
          ? `。推測が命中し、${target.nickname} は脱落しました。`
          : "。推測は外れました。",
        eliminatedPlayerIds: hit ? [target.id] : [],
        instructions: [
          {
            type: "insert_action",
            actionType: "guess",
            payload: { targetId: target.id, guessedRank: input.guessedRank },
          },
        ],
      });
    }
    case "guess_reveal": {
      if (!target || input.guessedRank === undefined) {
        return successResult({
          effectActivated: false,
          logSuffix: noEffectMessage,
          eliminatedPlayerIds: [],
          instructions: [],
        });
      }
      if (target.hand.length === 0) {
        return successResult({
          effectActivated: false,
          logSuffix: "。相手の手札が存在せず効果は発動しませんでした。",
          eliminatedPlayerIds: [],
          instructions: [],
        });
      }
      const targetCard = target.hand[0] as CardId;
      const targetRank = CARD_DEFINITIONS[targetCard].rank;
      const targetName = CARD_DEFINITIONS[targetCard].name;
      const selfCard = input.actorHandAfterPlay[0] as CardId | undefined;
      const selfName = selfCard ? CARD_DEFINITIONS[selfCard].name : undefined;
      const hit = targetRank === input.guessedRank;
      return successResult({
        effectActivated: true,
        logSuffix: hit
          ? `。推測が命中し、${target.nickname} は手札を公開しました（${targetName}）。`
          : selfName
            ? `。推測は外れました。${input.actorNickname} は手札を公開しました（${selfName}）。`
            : "。推測は外れました。",
        eliminatedPlayerIds: [],
        instructions: [
          {
            type: "insert_action",
            actionType: "guess",
            payload: { targetId: target.id, guessedRank: input.guessedRank },
          },
        ],
      });
    }
    case "peek": {
      if (!target) {
        return successResult({
          effectActivated: false,
          logSuffix: noEffectMessage,
          eliminatedPlayerIds: [],
          instructions: [],
        });
      }
      return successResult({
        effectActivated: true,
        logSuffix: `。${target.nickname} の手札を覗き見ました。`,
        eliminatedPlayerIds: [],
        instructions: [{ type: "insert_action", actionType: "peek", payload: { targetId: target.id } }],
      });
    }
    case "compare": {
      if (!target) {
        return successResult({ effectActivated: false, logSuffix: noEffectMessage, eliminatedPlayerIds: [], instructions: [] });
      }
      const actorCard = input.actorHandAfterPlay[0] as CardId | undefined;
      const targetCard = target.hand[0] as CardId | undefined;
      if (!actorCard || !targetCard) {
        return successResult({ effectActivated: true, logSuffix: `。${target.nickname} と手札を比較しました。`, eliminatedPlayerIds: [], instructions: [{ type: "insert_action", actionType: "compare", payload: { targetId: target.id } }] });
      }
      const actorRank = CARD_DEFINITIONS[actorCard].rank;
      const targetRank = CARD_DEFINITIONS[targetCard].rank;
      const eliminated = actorRank === targetRank ? [] : actorRank > targetRank ? [target.id] : [input.actorId];
      return successResult({
        effectActivated: true,
        logSuffix: `。${target.nickname} と手札を比較しました。`,
        eliminatedPlayerIds: eliminated,
        instructions: [{ type: "insert_action", actionType: "compare", payload: { targetId: target.id } }],
      });
    }
    case "shield":
      return successResult({
        effectActivated: true,
        logSuffix: "。守護状態になりました。",
        eliminatedPlayerIds: [],
        instructions: [{ type: "set_shield", playerId: input.actorId }],
      });
    case "swap_hands": {
      if (!target) {
        return successResult({ effectActivated: false, logSuffix: noEffectMessage, eliminatedPlayerIds: [], instructions: [] });
      }
      return successResult({
        effectActivated: true,
        logSuffix:
          input.cardId === "ambush"
            ? `。${target.nickname} の手札を確認し、決断を下しました。`
            : `。${target.nickname} と手札を交換しました。`,
        eliminatedPlayerIds: [],
        instructions: [{ type: "swap_hands", playerA: input.actorId, playerB: target.id }],
      });
    }
    case "conditional_discard":
      return successResult({ effectActivated: true, logSuffix: "。静かに捨てられました。", eliminatedPlayerIds: [], instructions: [] });
    case "self_eliminate":
      return successResult({ effectActivated: true, logSuffix: "。照耀の重責により自滅しました。", eliminatedPlayerIds: [input.actorId], instructions: [] });
    case "force_discard": {
      if (!target) {
        return successResult({ effectActivated: false, logSuffix: noEffectMessage, eliminatedPlayerIds: [], instructions: [] });
      }
      return successResult({
        effectActivated: true,
        logSuffix: `。${target.nickname} の手札を捨てさせました。`,
        eliminatedPlayerIds: [],
        instructions: [
          { type: "force_discard", targetId: target.id },
          { type: "insert_action", actionType: "force_discard", payload: { targetId: target.id } },
        ],
      });
    }
    default:
      return { ok: false, message: "未対応の効果です。", effectActivated: false, logSuffix: "", eliminatedPlayerIds: [], instructions: [] };
  }
}
