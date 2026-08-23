import type { OhlcBar } from "./parse";

const CHART_STORAGE = "coinbasebot.chart";

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

export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: Array<number | null>; signal: Array<number | null>; hist: Array<number | null> } {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const line: Array<number | null> = closes.map((_, i) =>
    fastE[i] != null && slowE[i] != null ? (fastE[i] as number) - (slowE[i] as number) : null,
  );
  const defined = line.map((v) => v ?? 0);
  const first = line.findIndex((v) => v != null);
  const signalLine: Array<number | null> = Array(closes.length).fill(null);
  if (first >= 0) {
    const slice = defined.slice(first);
    const sig = ema(slice, signal);
    for (let i = 0; i < sig.length; i += 1) signalLine[first + i] = sig[i];
  }
  const hist = line.map((v, i) => (v != null && signalLine[i] != null ? v - (signalLine[i] as number) : null));
  return { macd: line, signal: signalLine, hist };
}

export function bollinger(
  closes: number[],
  period = 20,
  k = 2,
): { mid: Array<number | null>; upper: Array<number | null>; lower: Array<number | null> } {
  const mid = sma(closes, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (mid[i] == null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const window = closes.slice(i - period + 1, i + 1);
    const mean = mid[i] as number;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push(mean + k * std);
    lower.push(mean - k * std);
  }
  return { mid, upper, lower };
}

export function vwap(bars: OhlcBar[]): Array<number | null> {
  const out: Array<number | null> = [];
  let pv = 0;
  let vol = 0;
  let day = -1;
  for (const bar of bars) {
    const utcDay = Math.floor(bar.start / 86400);
    if (utcDay !== day) {
      pv = 0;
      vol = 0;
      day = utcDay;
    }
    const typical = (bar.high + bar.low + bar.close) / 3;
    pv += typical * bar.volume;
    vol += bar.volume;
    out.push(vol > 0 ? pv / vol : null);
  }
  return out;
}

export function loadStudies(): StudyConfig {
  try {
    const raw = localStorage.getItem(CHART_STORAGE);
    if (!raw) return { ...DEFAULT_STUDIES };
    const parsed = JSON.parse(raw) as { studies?: Partial<StudyConfig> };
    return { ...DEFAULT_STUDIES, ...(parsed.studies || {}) };
  } catch {
    return { ...DEFAULT_STUDIES };
  }
}

export function saveStudies(studies: StudyConfig) {
  try {
    const prev = JSON.parse(localStorage.getItem(CHART_STORAGE) || "{}") as Record<string, unknown>;
    localStorage.setItem(CHART_STORAGE, JSON.stringify({ ...prev, studies }));
  } catch {
    // ignore
  }
}
