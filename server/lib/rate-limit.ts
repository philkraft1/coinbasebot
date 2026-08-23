type Bucket = { hits: number; resetAt: number };

export function createRateLimiter({ windowMs = 10 * 60 * 1000, max = 20 } = {}) {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string, now = Date.now()): boolean {
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { hits: 1, resetAt: now + windowMs });
        return true;
      }
      if (existing.hits >= max) return false;
      existing.hits += 1;
      return true;
    },
  };
}
