import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const DEFAULT_BASE_URL = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const DEFAULT_SETTLE_MS = 2500;

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    outputPath: "",
    settleMs: DEFAULT_SETTLE_MS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--base-url" && argv[i + 1]) {
      options.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--output" && argv[i + 1]) {
      options.outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--settle-ms" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.settleMs = Math.floor(parsed);
      }
      i += 1;
    }
  }

  return options;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index] ?? 0;
}

async function waitForGameUi(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasTable = (await page.locator(".bg-table-felt").count().catch(() => 0)) > 0;
    if (hasTable) return;

    const hasFallbackText = await page
      .getByText(/ターン待機中|現在手札|観戦モード|あなたの番|手番/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (hasFallbackText) return;

    await page.waitForTimeout(400);
  }
  throw new Error("Game UI did not become visible in time.");
}

async function writeJsonIfNeeded(filePath, payload) {
  if (!filePath) return;
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    const store = {
      longTasks: [],
      paints: {},
      lcp: 0,
      inputDelays: [],
    };

    window.__llrPerfProfile = store;

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          store.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          store.paints[entry.name] = entry.startTime;
        }
      }).observe({ type: "paint", buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) store.lcp = latest.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    window.addEventListener(
      "pointerdown",
      () => {
        const start = performance.now();
        requestAnimationFrame(() => {
          store.inputDelays.push(performance.now() - start);
        });
      },
      { passive: true },
    );
  });

  const startAt = Date.now();
  await page.goto(`${options.baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(options.settleMs);
  await page.mouse.click(48, 48);
  await page.waitForTimeout(120);

  const lobby = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const metrics = window.__llrPerfProfile;
    const longTasks50 = metrics.longTasks.filter((task) => task.duration >= 50);
    return {
      navigation: nav
        ? {
            responseStart: nav.responseStart,
            domContentLoaded: nav.domContentLoadedEventEnd,
            load: nav.loadEventEnd,
          }
        : null,
      firstContentfulPaint: metrics.paints["first-contentful-paint"] ?? 0,
      largestContentfulPaint: metrics.lcp ?? 0,
      longTaskCount50ms: longTasks50.length,
      maxLongTaskMs: longTasks50.length
        ? Math.max(...longTasks50.map((task) => task.duration))
        : 0,
      inputDelays: metrics.inputDelays,
    };
  });

  const nicknameInput = page
    .getByLabel(/ニックネーム|Nickname/i)
    .or(page.getByPlaceholder(/例|name|nickname/i))
    .first();
  await nicknameInput.fill(`Perf_${Math.floor(Math.random() * 10000)}`);

  const transitionStartedAt = Date.now();
  await page.getByRole("button", { name: /Bot対戦を開始|Create Room|Start/i }).first().click();
  await page.waitForURL(/\/game\//, { timeout: 25000 });
  await waitForGameUi(page, 45000);
  await page.waitForTimeout(options.settleMs);
  await page.mouse.click(220, 640);
  await page.waitForTimeout(120);

  const game = await page.evaluate(() => {
    const metrics = window.__llrPerfProfile;
    const longTasks50 = metrics.longTasks.filter((task) => task.duration >= 50);
    return {
      longTaskCount50ms: longTasks50.length,
      maxLongTaskMs: longTasks50.length
        ? Math.max(...longTasks50.map((task) => task.duration))
        : 0,
      inputDelays: metrics.inputDelays,
    };
  });

  await browser.close();

  const lobbyInputP95 = percentile(lobby.inputDelays, 0.95);
  const gameInputP95 = percentile(game.inputDelays, 0.95);

  const result = {
    measuredAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    settleMs: options.settleMs,
    startupToLobbyMs: Date.now() - startAt,
    roomTransitionToGameUiMs: Date.now() - transitionStartedAt,
    lobby: {
      ...lobby,
      inputDelayP95Ms: Number(lobbyInputP95.toFixed(2)),
      inputSampleCount: lobby.inputDelays.length,
      inputDelays: undefined,
    },
    game: {
      ...game,
      inputDelayP95Ms: Number(gameInputP95.toFixed(2)),
      inputSampleCount: game.inputDelays.length,
      inputDelays: undefined,
    },
  };

  await writeJsonIfNeeded(options.outputPath, result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
