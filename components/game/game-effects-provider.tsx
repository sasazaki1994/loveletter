"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAnimate } from "framer-motion";

import { ParticlesCanvas, type ParticleBurst } from "@/components/game/particles-canvas";

export type ShakeOptions = { intensity?: number; durationMs?: number; axis?: "xy" | "x" | "y" };
export type HitstopOptions = { holdMs?: number; flash?: boolean };

export interface GameEffectsApi {
	triggerScreenShake: (opts?: ShakeOptions) => Promise<void> | void;
	triggerHitstop: (opts?: HitstopOptions) => Promise<void>;
	emitParticles: (burst: ParticleBurst) => void;
}

const GameEffectsContext = createContext<GameEffectsApi | null>(null);

interface GameEffectsProviderProps {
	children: React.ReactNode;
}

export function GameEffectsProvider({ children }: GameEffectsProviderProps) {
	const [scope, animate] = useAnimate();
	const particlesRef = useRef<{ emit: (burst: ParticleBurst) => void } | null>(null);
	const [flashToken, setFlashToken] = useState<number>(0);
	const reducedMotionRef = useRef<boolean>(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
		reducedMotionRef.current = !!mql.matches;
		const handler = () => {
			reducedMotionRef.current = !!mql.matches;
		};
		mql.addEventListener?.("change", handler);
		return () => mql.removeEventListener?.("change", handler);
	}, []);

	const triggerScreenShake = useCallback(
		async ({ intensity = 12, durationMs = 180, axis = "xy" }: ShakeOptions = {}) => {
			const node = scope.current as unknown as HTMLElement | null;
			if (!node) return;
			if (reducedMotionRef.current) return; // respect prefers-reduced-motion
			const dx = axis !== "y" ? intensity : 0;
			const dy = axis !== "x" ? intensity : 0;
			await animate(
				node,
				{
					x: [0, dx, -dx, dx * 0.6, -dx * 0.6, 0],
					y: [0, dy, -dy, dy * 0.6, -dy * 0.6, 0],
					rotate: [0, 1.4, -1.4, 0.8, -0.8, 0],
				},
				{ duration: durationMs / 1000, ease: "easeInOut" },
			);
		},
		[animate, scope],
	);

	const triggerHitstop = useCallback(async ({ holdMs = 90, flash = true }: HitstopOptions = {}) => {
		if (flash) {
			// トグルしてCSS側のflashエフェクトを再生
			if (!reducedMotionRef.current) setFlashToken((v) => v + 1);
		}
		const scaled = reducedMotionRef.current ? Math.round(holdMs * 0.6) : holdMs;
		await new Promise((resolve) => setTimeout(resolve, Math.max(0, scaled)));
	}, []);

	const emitParticles = useCallback((burst: ParticleBurst) => {
		if (reducedMotionRef.current) {
			// 軽量化: 粒子数を減らす
			particlesRef.current?.emit({ ...burst, count: Math.max(6, Math.round((burst.count ?? 12) * 0.5)) });
			return;
		}
		particlesRef.current?.emit(burst);
	}, []);

	const api: GameEffectsApi = useMemo(
		() => ({ triggerScreenShake, triggerHitstop, emitParticles }),
		[emitParticles, triggerHitstop, triggerScreenShake],
	);

	return (
		<div ref={scope as unknown as React.RefObject<HTMLDivElement>} className="relative will-change-transform">
			<GameEffectsContext.Provider value={api}>
				{/* フラッシュオーバーレイ */}
				<FlashOverlay key={`flash-${flashToken}`} />
				{/* 粒子 */}
				<ParticlesCanvas ref={particlesRef as any} />
				{children}
			</GameEffectsContext.Provider>
		</div>
	);
}

export function useGameEffects(): GameEffectsApi {
	const ctx = useContext(GameEffectsContext);
	if (!ctx) throw new Error("useGameEffects must be used within GameEffectsProvider");
	return ctx;
}

function FlashOverlay() {
	// keyの変化で一瞬の露光を再生
	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 z-[25] opacity-0 [--flash-duration:120ms]"
			style={{}}
		>
			<div className="absolute inset-0 bg-white/70 will-change-opacity animate-[flash_var(--flash-duration)_ease-out_1]" />
		</div>
	);
}
