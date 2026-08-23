import { DEFAULT_STUDIES, type StudyConfig } from "./studies.ts";
import { INTERVALS, RANGES, type IntervalId, type RangeId } from "./timeframes.ts";

export type ChartPrefs = {
  interval: IntervalId;
  customMinutes: number;
  range: RangeId;
  studies: StudyConfig;
  focusedProduct: string;
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
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeChartPrefs(input: unknown): ChartPrefs {
  const raw = asRecord(input);
  const studies = asRecord(raw.studies);
  const interval =
    raw.interval === "custom" || INTERVALS.includes(raw.interval as (typeof INTERVALS)[number])
      ? (raw.interval as IntervalId)
      : DEFAULT_PREFS.interval;
  const range = RANGES.includes(raw.range as RangeId) ? (raw.range as RangeId) : DEFAULT_PREFS.range;
  const minutes = Number(raw.customMinutes);
  const product = typeof raw.focusedProduct === "string" ? raw.focusedProduct.trim().toUpperCase() : "";
  return {
    interval,
    customMinutes: Number.isFinite(minutes) ? Math.min(1440, Math.max(1, minutes)) : DEFAULT_PREFS.customMinutes,
    range,
    focusedProduct: /^[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(product) ? product : DEFAULT_PREFS.focusedProduct,
    studies: {
      sma20: bool(studies.sma20, DEFAULT_STUDIES.sma20),
      sma50: bool(studies.sma50, DEFAULT_STUDIES.sma50),
      sma200: bool(studies.sma200, DEFAULT_STUDIES.sma200),
      ema12: bool(studies.ema12, DEFAULT_STUDIES.ema12),
      ema26: bool(studies.ema26, DEFAULT_STUDIES.ema26),
      bb: bool(studies.bb, DEFAULT_STUDIES.bb),
      bbPeriod: num(studies.bbPeriod, DEFAULT_STUDIES.bbPeriod, 2, 400),
      bbStd: num(studies.bbStd, DEFAULT_STUDIES.bbStd, 0.1, 8),
      vwap: bool(studies.vwap, DEFAULT_STUDIES.vwap),
      rsi: bool(studies.rsi, DEFAULT_STUDIES.rsi),
      rsiPeriod: num(studies.rsiPeriod, DEFAULT_STUDIES.rsiPeriod, 2, 400),
      macd: bool(studies.macd, DEFAULT_STUDIES.macd),
      macdFast: num(studies.macdFast, DEFAULT_STUDIES.macdFast, 2, 400),
      macdSlow: num(studies.macdSlow, DEFAULT_STUDIES.macdSlow, 2, 400),
      macdSignal: num(studies.macdSignal, DEFAULT_STUDIES.macdSignal, 2, 400),
      volSma: bool(studies.volSma, DEFAULT_STUDIES.volSma),
      volSmaPeriod: num(studies.volSmaPeriod, DEFAULT_STUDIES.volSmaPeriod, 2, 400),
    } as StudyConfig,
  };
}

export function loadLocalPrefs(): ChartPrefs {
  try {
    return normalizeChartPrefs(JSON.parse(localStorage.getItem("coinbasebot.chart") || "{}"));
  } catch {
    return { ...DEFAULT_PREFS, studies: { ...DEFAULT_STUDIES } };
  }
}

export function saveLocalPrefs(prefs: ChartPrefs) {
  try {
    localStorage.setItem("coinbasebot.chart", JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}
