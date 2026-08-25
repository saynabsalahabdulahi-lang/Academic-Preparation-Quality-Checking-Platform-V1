/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * NOTE: this is per-instance and resets on cold start. It is a first line of
 * defense against abuse of expensive endpoints (upload, AI). For strict,
 * distributed limits, back this with Redis/Upstash in a later hardening pass.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, retryAfterMs: 0 };
}
