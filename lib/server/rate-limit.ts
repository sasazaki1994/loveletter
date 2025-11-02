type Entry = { count: number; resetAt: number };

const BUCKET = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = BUCKET.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    BUCKET.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (entry.count < limit) {
    entry.count += 1;
    return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }
  return { ok: false, remaining: 0, resetAt: entry.resetAt };
}


