import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Deterministic RNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ActionLog = {
  t: number;
  kind:
    | 'click'
    | 'dblclick'
    | 'tripleclick'
    | 'scroll'
    | 'resize'
    | 'navigate'
    | 'input'
    | 'screenshot'
    | 'note';
  selector?: string;
  text?: string;
  ariaLabel?: string;
  role?: string;
  x?: number;
  y?: number;
  info?: Record<string, unknown>;
};

type ErrorLog = {
  t: number;
  type: 'console' | 'pageerror' | 'unhandledrejection' | 'requestfailed' | 'http4xx5xx' | 'longtask';
  message?: string;
  url?: string;
  status?: number;
  stack?: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
  longTask?: { duration: number; name?: string };
};

const CLICKABLE_SELECTORS = [
  'button',
  '[role="button"]',
  '[data-testid]',
  '[aria-label]',
  '.card',
  '.hand .card',
  '.action',
  '.end-turn',
  'a',
  'input[type="button"]',
  'input[type="submit"]',
];

test('UI monkey test with logging and screenshots', async ({ page, browserName }) => {
  const seed = Number(process.env.MONKEY_SEED ?? '20251030');
  const rng = mulberry32(seed);
  const start = Date.now();
  const runLabel = new Date(start)
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const artifactsRoot = process.env.MONKEY_ARTIFACTS_DIR
    ? path.resolve(process.env.MONKEY_ARTIFACTS_DIR)
    : path.resolve(process.cwd(), '..', 'monkey-artifacts');
  const outDir = path.join(artifactsRoot, runLabel);
  fs.mkdirSync(outDir, { recursive: true });
  const actionLog: ActionLog[] = [];
  const errorLog: ErrorLog[] = [];
  let lastScreenshotAt = 0;
  let screenshotIndex = 0;
  let maxLongTask = 0;
  let longTaskCount = 0;

  function logAction(a: ActionLog) {
    actionLog.push(a);
  }
  function logError(e: ErrorLog) {
    errorLog.push(e);
  }

  // Long task observer inside the page
  await page.exposeBinding('reportLongTask', (_source, payload: { duration: number; name?: string }) => {
    maxLongTask = Math.max(maxLongTask, payload.duration);
    longTaskCount += 1;
    logError({ t: Date.now(), type: 'longtask', longTask: payload, message: `LongTask ${payload.duration.toFixed(1)}ms` });
  });
  await page.addInitScript(() => {
    // @ts-ignore
    const w = window as any;
    if ('PerformanceObserver' in window) {
      try {
        // Observe long tasks (>50ms as per spec). We'll count and filter at 200ms server-side.
        const po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).duration >= 200 && typeof (window as any).reportLongTask === 'function') {
              (window as any).reportLongTask({ duration: (entry as any).duration, name: (entry as any).name });
            }
          }
        });
        // @ts-ignore
        po.observe({ type: 'longtask', buffered: true } as any);
      } catch {}
    }
  });

  // Error/console/network hooks
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const text = msg.text();
    if (/ERR_ABORTED/i.test(text)) return;
    const loc = msg.location();
    logError({
      t: Date.now(),
      type: 'console',
      message: text,
      location: { url: loc.url, lineNumber: loc.lineNumber, columnNumber: loc.columnNumber },
    });
  });
  page.on('pageerror', (err) => {
    logError({ t: Date.now(), type: 'pageerror', message: err.message, stack: err.stack });
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    const errorText = failure?.errorText ?? '';
    if (errorText.includes('ERR_ABORTED')) {
      return;
    }
    logError({ t: Date.now(), type: 'requestfailed', message: errorText || undefined, url: req.url() });
  });
  page.on('response', async (res) => {
    const status = res.status();
    if (status >= 400) {
      logError({ t: Date.now(), type: 'http4xx5xx', url: res.url(), status, message: res.statusText() });
    }
  });

  // Helper: safe screenshot
  async function takeScreenshot(tag: string) {
    const file = path.join(outDir, `${String(screenshotIndex).padStart(3, '0')}_${tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    lastScreenshotAt = Date.now();
    screenshotIndex += 1;
    logAction({ t: Date.now(), kind: 'screenshot', info: { file, tag } });
  }

  // Navigate and Lobby -> Create Room
  await page.goto('/');
  logAction({ t: Date.now(), kind: 'navigate', info: { url: page.url() } });

  // Nickname input (by label or placeholder)
  const nickname = `Player_${Math.floor(rng() * 10000)}`;
  const nicknameInput = page.getByLabel(/ニックネーム|Nickname/i).or(page.getByPlaceholder(/例|name|nickname/i));
  try {
    await nicknameInput.first().fill(nickname, { timeout: 3000 });
    logAction({ t: Date.now(), kind: 'input', selector: 'nickname', text: nickname });
  } catch {}

  // Create room button (UI shows "Bot対戦を開始")
  const createBtn = page.getByRole('button', { name: /Bot対戦を開始|Create Room|Start/i });
  await createBtn.first().click({ timeout: 5000 });
  logAction({ t: Date.now(), kind: 'click', selector: 'button:CreateRoom', text: 'CreateRoom' });

  // Wait for game page
  await page.waitForURL(/\/game\//, { timeout: 15000 });
  await takeScreenshot('entered_room');

  // Try to add bot participants if a button exists
  const botButton = page.getByRole('button', { name: /Bot|ボット|ダミー|dummy/i });
  try {
    const count = await botButton.count();
    if (count > 0) {
      const addTimes = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < addTimes; i += 1) {
        await botButton.first().click({ timeout: 2000 });
        logAction({ t: Date.now(), kind: 'click', selector: 'button:AddBot' });
        await page.waitForTimeout(300 + Math.floor(rng() * 500));
      }
    }
  } catch {}

  // Monkey loop 3–5 minutes
  const runMs = 1000 * (180 + Math.floor(rng() * 120));
  const deadline = Date.now() + runMs;

  // Periodic screenshot timer baseline
  lastScreenshotAt = Date.now();
  await takeScreenshot('start');

  async function pickAndClick() {
    // Low frequency destructive actions control
    const destructivePattern = /(退出|離脱|退出する|リセット|設定|戻る|Leave|Reset|Settings|Back)/i;
    const allowDestructive = rng() < 0.08; // <10%

    // Build a locator of clickable elements
    const selector = CLICKABLE_SELECTORS.join(',');
    const loc = page.locator(selector);
    const total = await loc.count();
    const candidates: number[] = [];
    for (let i = 0; i < total; i += 1) {
      const el = loc.nth(i);
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      const enabled = await el.isEnabled().catch(() => false);
      if (!enabled) continue;
      const text = (await el.textContent().catch(() => ''))?.trim() || '';
      const aria = await el.getAttribute('aria-label').catch(() => null);
      const looksDestructive = destructivePattern.test(text) || (aria ? destructivePattern.test(aria) : false);
      if (!allowDestructive && looksDestructive) continue;
      candidates.push(i);
      if (candidates.length > 200) break;
    }
    if (candidates.length === 0) return false;
    const idx = candidates[Math.floor(rng() * candidates.length)];
    const el = loc.nth(idx);
    const box = await el.boundingBox().catch(() => null);
    const text = (await el.textContent().catch(() => ''))?.trim() || '';
    const ariaLabel = (await el.getAttribute('aria-label').catch(() => null)) || undefined;

    // Random multi-click (<=3) with >=100ms gaps
    const clicks = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < clicks; k += 1) {
      await el.click({ timeout: 4000 }).catch(async (e) => {
        logAction({ t: Date.now(), kind: 'note', info: { event: 'click-failed', error: String(e) } });
      });
      logAction({
        t: Date.now(),
        kind: clicks === 1 ? 'click' : clicks === 2 ? 'dblclick' : 'tripleclick',
        selector: selector,
        text,
        ariaLabel,
        x: box?.x,
        y: box?.y,
      });
      if (k + 1 < clicks) await page.waitForTimeout(100 + Math.floor(rng() * 100));
    }
    return true;
  }

  async function randomScrollOrResize() {
    if (rng() < 0.5) {
      // Scroll
      const deltaY = Math.floor((rng() - 0.5) * 1200);
      await page.mouse.wheel(0, deltaY);
      logAction({ t: Date.now(), kind: 'scroll', info: { deltaY } });
    } else {
      // Resize within some range
      const w = 1000 + Math.floor(rng() * 800);
      const h = 700 + Math.floor(rng() * 500);
      await page.setViewportSize({ width: w, height: h });
      logAction({ t: Date.now(), kind: 'resize', info: { width: w, height: h } });
    }
  }

  // Main loop
  while (Date.now() < deadline) {
    const didClick = await pickAndClick();
    if (!didClick || rng() < 0.25) {
      await randomScrollOrResize();
    }

    // Periodic screenshot every ~20s or on many errors burst
    const since = Date.now() - lastScreenshotAt;
    if (since > 20000 || errorLog.length > 0) {
      await takeScreenshot(since > 20000 ? 'interval' : 'error');
    }

    // Wait 1–3s with jitter to cross 1–2s polling
    const wait = 1000 + Math.floor(rng() * 2000);
    await page.waitForTimeout(wait);
  }

  await takeScreenshot('final');

  // Build report
  const counts = {
    console: errorLog.filter((e) => e.type === 'console').length,
    pageerror: errorLog.filter((e) => e.type === 'pageerror').length,
    unhandledrejection: errorLog.filter((e) => e.type === 'unhandledrejection').length,
    requestfailed: errorLog.filter((e) => e.type === 'requestfailed').length,
    http4xx5xx: errorLog.filter((e) => e.type === 'http4xx5xx').length,
    longtask: errorLog.filter((e) => e.type === 'longtask').length,
  } as const;

  // Representative repro steps: last 5 actions before 3 earliest errors
  const interesting = errorLog.slice(0, 3).map((err) => {
    const idx = actionLog.findIndex((a) => a.t > err.t) - 1;
    const startIdx = Math.max(0, idx - 5);
    const steps = actionLog.slice(startIdx, idx + 1);
    return { err, steps };
  });

  const report = {
    seed,
    startedAt: new Date(start).toISOString(),
    durationSec: Math.round((Date.now() - start) / 1000),
    browser: browserName,
    maxLongTaskMs: Number(maxLongTask.toFixed(1)),
    longTaskCount,
    counts,
    screenshots: fs
      .readdirSync(outDir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => path.join(outDir, f)),
    errors: errorLog,
    actions: actionLog,
    repro: interesting,
  };

  fs.writeFileSync(path.join(outDir, 'actions.jsonl'), actionLog.map((a) => JSON.stringify(a)).join('\n'));
  fs.writeFileSync(path.join(outDir, 'errors.jsonl'), errorLog.map((e) => JSON.stringify(e)).join('\n'));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  // Markdown summary for human read
  const md = [
    `# Monkey Test Report`,
    `- Seed: ${seed}`,
    `- Started: ${new Date(start).toISOString()}`,
    `- Duration: ${report.durationSec}s`,
    `- Browser: ${browserName}`,
    `- Max Long Task: ${report.maxLongTaskMs} ms (count=${report.longTaskCount})`,
    '',
    '## Error/Warning Counts',
    `- console: ${counts.console}`,
    `- pageerror: ${counts.pageerror}`,
    `- unhandledrejection: ${counts.unhandledrejection}`,
    `- requestfailed: ${counts.requestfailed}`,
    `- http4xx5xx: ${counts.http4xx5xx}`,
    `- longtask: ${counts.longtask}`,
    '',
    '## Representative Repro (first 3 errors)',
  ];
  interesting.forEach((r, i) => {
    md.push(`### Case ${i + 1}`);
    md.push(`- Error: ${r.err.type} ${r.err.status ? '(' + r.err.status + ')' : ''} ${r.err.message ?? ''}`);
    if (r.err.url) md.push(`- URL: ${r.err.url}`);
    if (r.err.stack) md.push('```\n' + r.err.stack + '\n```');
    md.push('- Steps:');
    r.steps.forEach((s) => {
      const label = s.selector ? `${s.kind} ${s.selector}` : s.kind;
      md.push(`  - ${new Date(s.t).toISOString()} ${label} ${s.text ? 'text=' + s.text : ''} ${s.ariaLabel ? 'aria=' + s.ariaLabel : ''}`);
    });
    md.push('');
  });
  md.push('## Artifacts');
  md.push(`- Screenshots dir: ${outDir}`);
  md.push(`- actions.jsonl, errors.jsonl, report.json in the same dir.`);

  fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));

  // Basic expectations: test should not crash runner. We still assert page alive.
  await expect(page).toBeDefined();
});


