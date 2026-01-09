"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type ParticleKind = "spark" | "confetti" | "dust" | "heart";

export interface ParticleBurst {
	kind: ParticleKind;
	count?: number;
	hue?: number;
	origin: { x: number; y: number }; // viewport座標(px)
}

interface Particle {
	x: number; y: number; vx: number; vy: number; life: number; ttl: number; size: number; color: string; g: number;
}

export const ParticlesCanvas = forwardRef<{ emit: (burst: ParticleBurst) => void }, {}>(function ParticlesCanvas(_, ref) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const particlesRef = useRef<Particle[]>([]);
	const rafRef = useRef<number | null>(null);
	const dprRef = useRef<number>(1);
	const isRunningRef = useRef<boolean>(false);
	const lastTsRef = useRef<number>(0);
	const startRef = useRef<(() => void) | null>(null);
	const stopRef = useRef<(() => void) | null>(null);

	const MAX_PARTICLES = 600;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d", { alpha: true });
		if (!ctx) return;

		const resize = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			dprRef.current = dpr;
			canvas.width = Math.floor(window.innerWidth * dpr);
			canvas.height = Math.floor(window.innerHeight * dpr);
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
		};
		resize();
		window.addEventListener("resize", resize);

		ctx.globalCompositeOperation = "lighter";

		const stop = () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
			isRunningRef.current = false;
		};

		const start = () => {
			if (isRunningRef.current) return;
			if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
			isRunningRef.current = true;
			lastTsRef.current = performance.now();
			rafRef.current = requestAnimationFrame(tick);
		};

		const tick = (t: number) => {
			// 非表示中は停止（復帰時にvisibilitychangeで再開）
			if (typeof document !== "undefined" && document.visibilityState === "hidden") {
				stop();
				return;
			}

			const dpr = dprRef.current;
			const dtMs = Math.min(48, Math.max(8, t - (lastTsRef.current || t)));
			lastTsRef.current = t;
			const step = dtMs / 16;

			const src = particlesRef.current;
			let write = 0;

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.globalAlpha = 1;

			for (let i = 0; i < src.length; i += 1) {
				const p = src[i]!;
				const nextLife = p.life - dtMs;
				if (nextLife <= 0) continue;
				p.life = nextLife;
				p.vy += p.g * step;
				p.x += p.vx * step;
				p.y += p.vy * step;

				const alpha = Math.max(0, p.life / p.ttl);
				ctx.fillStyle = p.color;
				ctx.globalAlpha = alpha;
				ctx.beginPath();
				ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
				ctx.fill();

				src[write] = p;
				write += 1;
			}

			if (write !== src.length) {
				src.length = write;
			}

			// 粒子が無ければ停止（次のemitで再開）
			if (src.length === 0) {
				stop();
				return;
			}

			rafRef.current = requestAnimationFrame(tick);
		};

		const onVisibility = () => {
			if (document.visibilityState === "hidden") {
				stop();
				return;
			}
			// 復帰時に粒子が残っていれば再開
			if (particlesRef.current.length > 0) {
				start();
			}
		};

		document.addEventListener?.("visibilitychange", onVisibility);
		startRef.current = start;
		stopRef.current = stop;

		// 初期化前にemitされた粒子があれば、初回描画を開始
		if (particlesRef.current.length > 0) {
			start();
		}

		return () => {
			stop();
			startRef.current = null;
			stopRef.current = null;
			document.removeEventListener?.("visibilitychange", onVisibility);
			window.removeEventListener("resize", resize);
		};
	}, []);

	useImperativeHandle(ref, () => ({
		emit: (burst: ParticleBurst) => {
			const { kind, count = 24, hue = 40, origin } = burst;
			const desired = Math.max(0, Math.min(MAX_PARTICLES, Math.round(count)));
			const particles: Particle[] = [];
			for (let i = 0; i < desired; i++) {
				const speed = kind === "confetti" ? rand(1.2, 2.4) : rand(0.8, 2.2);
				const angle = Math.random() * Math.PI * 2;
				const vx = Math.cos(angle) * speed;
				const vy = Math.sin(angle) * speed * (kind === "spark" ? -1 : 1);
				const ttl = kind === "dust" ? rand(500, 900) : rand(300, 700);
				const size = kind === "confetti" ? rand(2.5, 4) : kind === "heart" ? rand(2.2, 3.2) : rand(1.8, 3.2);
				const g = kind === "spark" ? 0.06 : 0.08;
				const color = `hsl(${hue + rand(-12, 12)}, 90%, ${kind === "dust" ? 70 : 60}%)`;
				particles.push({ x: origin.x, y: origin.y, vx, vy, life: ttl, ttl, size, color, g });
			}

			// 粒子上限（古いものから落として新しいものを優先）
			const existing = particlesRef.current;
			const keep = Math.max(0, MAX_PARTICLES - particles.length);
			const trimmed = existing.length > keep ? existing.slice(existing.length - keep) : existing;
			particlesRef.current = trimmed.concat(particles);

			// 粒子があるときだけ描画ループを開始
			startRef.current?.();
		},
	}));

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none fixed inset-0 z-[24]"
			aria-hidden
		/>
	);
});

function rand(min: number, max: number) {
	return Math.random() * (max - min) + min;
}
