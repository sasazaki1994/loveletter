import type { CardId } from "@/lib/game/types";

export type ShakePreset = { intensity?: number; durationMs?: number };
export type HitstopPreset = { holdMs?: number; flash?: boolean };
export type ParticlesPreset = { kind?: "spark" | "confetti" | "dust" | "heart"; count?: number; hue?: number };

export interface CardFxPreset {
	shake?: ShakePreset;
	hitstop?: HitstopPreset;
	particles?: ParticlesPreset;
}

export const CARD_FX_PRESETS: Partial<Record<CardId, CardFxPreset>> = {
	sentinel: { shake: { intensity: 10 }, hitstop: { holdMs: 80, flash: true }, particles: { kind: "spark", hue: 45, count: 18 } },
	oracle: { shake: { intensity: 6 }, particles: { kind: "spark", hue: 190, count: 14 } },
	duelist: { shake: { intensity: 12 }, hitstop: { holdMs: 80, flash: true }, particles: { kind: "spark", hue: 35, count: 22 } },
	warder: { shake: { intensity: 8 }, particles: { kind: "dust", hue: 160, count: 18 } },
	legate: { shake: { intensity: 12 }, hitstop: { holdMs: 90, flash: false }, particles: { kind: "spark", hue: 25, count: 20 } },
	arbiter: { shake: { intensity: 10 }, particles: { kind: "confetti", hue: 45, count: 26 } },
	vizier: { shake: { intensity: 6 }, particles: { kind: "dust", hue: 280, count: 14 } },
	emissary: { shake: { intensity: 16 }, hitstop: { holdMs: 110, flash: true }, particles: { kind: "spark", hue: 5, count: 28 } },
};
