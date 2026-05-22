import { z } from "zod";

import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";

export const cardIdValues = Object.keys(CARD_DEFINITIONS) as [CardId, ...CardId[]];

export const payloadSchema = z
  .object({
    cardId: z.enum(cardIdValues).optional(),
    targetId: z.string().uuid().optional(),
    guessedRank: z.number().int().min(1).max(8).optional(),
    effectChoice: z.string().optional(),
  })
  .optional();

export const actionSchema = z.object({
  gameId: z.string().uuid(),
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
  type: z.enum(["play_card", "resign"]),
  payload: payloadSchema,
});
