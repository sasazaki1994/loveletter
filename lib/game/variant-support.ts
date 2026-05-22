import type { CardId } from "@/lib/game/types";

export const SUPPORTED_VARIANT_CARD_IDS = ["feint", "wager", "marquise"] as const satisfies readonly CardId[];

export function isSupportedVariantCardId(cardId: CardId): boolean {
  return (SUPPORTED_VARIANT_CARD_IDS as readonly CardId[]).includes(cardId);
}
