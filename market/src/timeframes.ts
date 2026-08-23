export const INTERVALS = ["1m", "5m", "15m", "1H", "1D"] as const;
export type IntervalId = (typeof INTERVALS)[number] | "custom";

export const RANGES = ["1D", "5D", "1M", "3M", "YTD", "1Y"] as const;
export type RangeId = (typeof RANGES)[number];

export const INTERVAL_SECONDS: Record<Exclude<IntervalId, "custom">, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "1D": 86400,
};

export const NATIVE_GRANULARITY: Record<number, string> = {
  60: "ONE_MINUTE",
  300: "FIVE_MINUTE",
  900: "FIFTEEN_MINUTE",
  3600: "ONE_HOUR",
  86400: "ONE_DAY",
};

export const MAX_BARS = 400;
export const CHART_STORAGE = "coinbasebot.chart";

export function intervalSeconds(interval: IntervalId, customMinutes: number): number {
  if (interval === "custom") {
    const minutes = Math.min(1440, Math.max(1, Math.round(customMinutes) || 1));
    return minutes * 60;
  }
  return INTERVAL_SECONDS[interval];
}

export function rangeStartUtc(range: RangeId, nowMs = Date.now()): number {
  const now = Math.floor(nowMs / 1000);
  if (range === "1D") return now - 86400;
  if (range === "5D") return now - 5 * 86400;
  if (range === "1M") return now - 30 * 86400;
  if (range === "3M") return now - 90 * 86400;
  if (range === "1Y") return now - 365 * 86400;
  const year = new Date(nowMs).getUTCFullYear();
  return Math.floor(Date.UTC(year, 0, 1) / 1000);
}

export type SourcePlan = {
  granularity: string;
  bucketSeconds: number;
  hint: string | null;
};

export function planCandleSource(periodSeconds: number, rangeSeconds: number): SourcePlan {
  const honoredBars = rangeSeconds / Math.max(periodSeconds, 1);
  if (honoredBars <= MAX_BARS && NATIVE_GRANULARITY[periodSeconds]) {
    return { granularity: NATIVE_GRANULARITY[periodSeconds], bucketSeconds: periodSeconds, hint: null };
  }
  if (honoredBars <= MAX_BARS) {
    if (periodSeconds % 3600 === 0 && NATIVE_GRANULARITY[3600]) {
      return { granularity: "ONE_HOUR", bucketSeconds: periodSeconds, hint: null };
    }
    if (periodSeconds % 300 === 0) {
      return { granularity: "FIVE_MINUTE", bucketSeconds: periodSeconds, hint: null };
    }
    return { granularity: "ONE_MINUTE", bucketSeconds: periodSeconds, hint: null };
  }

  const natives = [86400, 3600, 900, 300, 60];
  for (const seconds of natives) {
    if (rangeSeconds / seconds <= MAX_BARS) {
      const label = seconds === 86400 ? "daily" : seconds === 3600 ? "hourly" : `${seconds / 60}m`;
      return {
        granularity: NATIVE_GRANULARITY[seconds],
        bucketSeconds: seconds,
        hint: `Range uses ${label} bars`,
      };
    }
  }
  return { granularity: "ONE_DAY", bucketSeconds: 86400, hint: "Range uses daily bars" };
}

export function loadChartPrefs(): {
  interval: IntervalId;
  customMinutes: number;
  range: RangeId;
} {
  try {
    const raw = localStorage.getItem(CHART_STORAGE);
    if (!raw) return { interval: "5m", customMinutes: 7, range: "1D" };
    const parsed = JSON.parse(raw) as { interval?: IntervalId; customMinutes?: number; range?: RangeId };
    const interval = parsed.interval === "custom" || INTERVALS.includes(parsed.interval as (typeof INTERVALS)[number])
      ? parsed.interval!
      : "5m";
    const range = RANGES.includes(parsed.range as RangeId) ? (parsed.range as RangeId) : "1D";
    return {
      interval,
      customMinutes: Math.min(1440, Math.max(1, Number(parsed.customMinutes) || 7)),
      range,
    };
  } catch {
    return { interval: "5m", customMinutes: 7, range: "1D" };
  }
}

export function saveChartPrefs(prefs: { interval: IntervalId; customMinutes: number; range: RangeId }) {
  try {
    const prev = JSON.parse(localStorage.getItem(CHART_STORAGE) || "{}") as Record<string, unknown>;
    localStorage.setItem(CHART_STORAGE, JSON.stringify({ ...prev, ...prefs }));
  } catch {
    // ignore quota / private mode
  }
}
