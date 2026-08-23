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
    studies: { ...DEFAULT_STUDIES, ...studies } as StudyConfig,
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
