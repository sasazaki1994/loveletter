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

		const tick = (t: number) => {
			const dpr = dprRef.current;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const now = performance.now();
			particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
			for (const p of particlesRef.current) {
				p.life -= 16; // 約60fps基準で減衰
				p.vy += p.g;
				p.x += p.vx;
				p.y += p.vy;
				const alpha = Math.max(0, p.life / p.ttl);
				ctx.fillStyle = p.color;
				ctx.globalAlpha = alpha;
				ctx.beginPath();
				ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
				ctx.fill();
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafe();
		function rafe() {
			renderStart();
		}
		function renderStart() {
			rafRef.current = requestAnimationFrame(tick);
		}
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			window.removeEventListener("resize", resize);
		};
	}, []);

	useImperativeHandle(ref, () => ({
		emit: (burst: ParticleBurst) => {
			const { kind, count = 24, hue = 40, origin } = burst;
			const particles: Particle[] = [];
			for (let i = 0; i < count; i++) {
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
			particlesRef.current = particlesRef.current.concat(particles);
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
