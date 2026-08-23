export const INTERVALS = ["1m", "5m", "15m", "1H", "1D"] as const;
export type IntervalId = (typeof INTERVALS)[number] | "custom";
export const RANGES = ["1D", "5D", "1M", "3M", "YTD", "1Y"] as const;
export type RangeId = (typeof RANGES)[number];

export type StudyConfig = {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema12: boolean;
  ema26: boolean;
  bb: boolean;
  bbPeriod: number;
  bbStd: number;
  vwap: boolean;
  rsi: boolean;
  rsiPeriod: number;
  macd: boolean;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  volSma: boolean;
  volSmaPeriod: number;
};

export type ChartPrefs = {
  interval: IntervalId;
  customMinutes: number;
  range: RangeId;
  studies: StudyConfig;
  focusedProduct: string;
};

export const DEFAULT_STUDIES: StudyConfig = {
  sma20: true,
  sma50: false,
  sma200: false,
  ema12: false,
  ema26: false,
  bb: false,
  bbPeriod: 20,
  bbStd: 2,
  vwap: false,
  rsi: false,
  rsiPeriod: 14,
  macd: false,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  volSma: true,
  volSmaPeriod: 20,
};

export const DEFAULT_PREFS: ChartPrefs = {
  interval: "5m",
  customMinutes: 7,
  range: "1D",
  studies: { ...DEFAULT_STUDIES },
  focusedProduct: "BTC-USD",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function productId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(trimmed) ? trimmed : fallback;
}

export function sanitizePrefs(input: unknown): ChartPrefs {
  const raw = asRecord(input);
  const studiesIn = asRecord(raw.studies);
  const interval =
    raw.interval === "custom" || INTERVALS.includes(raw.interval as (typeof INTERVALS)[number])
      ? (raw.interval as IntervalId)
      : DEFAULT_PREFS.interval;
  const range = RANGES.includes(raw.range as RangeId) ? (raw.range as RangeId) : DEFAULT_PREFS.range;
  return {
    interval,
    customMinutes: num(raw.customMinutes, DEFAULT_PREFS.customMinutes, 1, 1440),
    range,
    focusedProduct: productId(raw.focusedProduct, DEFAULT_PREFS.focusedProduct),
    studies: {
      sma20: bool(studiesIn.sma20, DEFAULT_STUDIES.sma20),
      sma50: bool(studiesIn.sma50, DEFAULT_STUDIES.sma50),
      sma200: bool(studiesIn.sma200, DEFAULT_STUDIES.sma200),
      ema12: bool(studiesIn.ema12, DEFAULT_STUDIES.ema12),
      ema26: bool(studiesIn.ema26, DEFAULT_STUDIES.ema26),
      bb: bool(studiesIn.bb, DEFAULT_STUDIES.bb),
      bbPeriod: num(studiesIn.bbPeriod, DEFAULT_STUDIES.bbPeriod, 2, 400),
      bbStd: num(studiesIn.bbStd, DEFAULT_STUDIES.bbStd, 0.1, 8),
      vwap: bool(studiesIn.vwap, DEFAULT_STUDIES.vwap),
      rsi: bool(studiesIn.rsi, DEFAULT_STUDIES.rsi),
      rsiPeriod: num(studiesIn.rsiPeriod, DEFAULT_STUDIES.rsiPeriod, 2, 400),
      macd: bool(studiesIn.macd, DEFAULT_STUDIES.macd),
      macdFast: num(studiesIn.macdFast, DEFAULT_STUDIES.macdFast, 2, 400),
      macdSlow: num(studiesIn.macdSlow, DEFAULT_STUDIES.macdSlow, 2, 400),
      macdSignal: num(studiesIn.macdSignal, DEFAULT_STUDIES.macdSignal, 2, 400),
      volSma: bool(studiesIn.volSma, DEFAULT_STUDIES.volSma),
      volSmaPeriod: num(studiesIn.volSmaPeriod, DEFAULT_STUDIES.volSmaPeriod, 2, 400),
    },
  };
}

export function prefsAreUnset(row: unknown): boolean {
  if (row == null) return true;
  if (typeof row !== "object") return true;
  return Object.keys(row as object).length === 0;
}
