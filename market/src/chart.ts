import type { OhlcBar } from "./parse";

export type CandleLayout = {
  x: number;
  bodyWidth: number;
  wickX: number;
  bodyY: number;
  bodyH: number;
  highY: number;
  lowY: number;
  volX: number;
  volY: number;
  volH: number;
  volW: number;
  up: boolean;
  start: number;
};

export type OverlayLine = { id: string; className: string; points: string };

export type PaneBar = { x: number; y: number; h: number; w: number; up: boolean };

export type ChartLayout = {
  width: number;
  height: number;
  padL: number;
  min: number;
  max: number;
  bars: CandleLayout[];
  labels: Array<{ x: number; text: string }>;
  priceLabels: Array<{ y: number; text: string }>;
  overlays: OverlayLine[];
  volSma: string;
  rsi: { line: string; labels: Array<{ y: number; text: string }> } | null;
  macd: { line: string; signal: string; hist: PaneBar[]; labels: Array<{ y: number; text: string }> } | null;
};

function yIn(value: number, min: number, range: number, top: number, height: number) {
  return top + (1 - (value - min) / range) * height;
}

function polyline(
  values: Array<number | null>,
  xs: number[],
  min: number,
  range: number,
  top: number,
  height: number,
): string {
  return values
    .map((value, i) =>
      value == null || !Number.isFinite(value) ? "" : `${xs[i].toFixed(2)},${yIn(value, min, range, top, height).toFixed(2)}`,
    )
    .filter(Boolean)
    .join(" ");
}

export type ChartStudies = {
  overlays: Array<{ id: string; className: string; values: Array<number | null> }>;
  volSma: Array<number | null> | null;
  rsi: Array<number | null> | null;
  macd: { macd: Array<number | null>; signal: Array<number | null>; hist: Array<number | null> } | null;
};

export function layoutCandleChart(
  bars: OhlcBar[],
  width = 1000,
  height = 400,
  periodSeconds = 300,
  studies: ChartStudies = { overlays: [], volSma: null, rsi: null, macd: null },
): ChartLayout {
  const padL = 64;
  const padR = 12;
  const padT = 10;
  const labelH = 16;
  const extra = (studies.rsi ? 1 : 0) + (studies.macd ? 1 : 0);
  const priceFrac = extra === 2 ? 0.5 : extra === 1 ? 0.58 : 0.7;
  const volFrac = extra ? 0.14 : 0.22;
  const paneFrac = extra ? (1 - priceFrac - volFrac - 0.04) / extra : 0;

  const priceH = height * priceFrac - padT;
  const volH = Math.max(height * volFrac, 12);
  const volTop = padT + priceH + 8;
  let cursor = volTop + volH + 8;
  const rsiH = studies.rsi ? height * paneFrac : 0;
  const rsiTop = cursor;
  if (studies.rsi) cursor += rsiH + 6;
  const macdH = studies.macd ? height * paneFrac : 0;
  const macdTop = cursor;

  const innerW = Math.max(width - padL - padR, 1);
  const empty = {
    width,
    height,
    padL,
    min: 0,
    max: 1,
    bars: [] as CandleLayout[],
    labels: [],
    priceLabels: [],
    overlays: [],
    volSma: "",
    rsi: null,
    macd: null,
  };
  if (bars.length === 0) return empty;

  let min = Math.min(...bars.map((bar) => bar.low));
  let max = Math.max(...bars.map((bar) => bar.high));
  for (const overlay of studies.overlays) {
    for (const value of overlay.values) {
      if (value == null || !Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) max = min + 1;
  const range = max - min;
  const maxVol = Math.max(...bars.map((bar) => bar.volume), 1);
  const slot = innerW / bars.length;
  const xs = bars.map((_, i) => padL + i * slot + slot * 0.31);

  const laid = bars.map((bar, index) => {
    const x = padL + index * slot;
    const top = yIn(Math.max(bar.open, bar.close), min, range, padT, priceH);
    const bottom = yIn(Math.min(bar.open, bar.close), min, range, padT, priceH);
    const volBarH = (bar.volume / maxVol) * volH;
    return {
      x,
      bodyWidth: Math.max(slot * 0.62, 1),
      wickX: xs[index],
      bodyY: top,
      bodyH: Math.max(bottom - top, 1),
      highY: yIn(bar.high, min, range, padT, priceH),
      lowY: yIn(bar.low, min, range, padT, priceH),
      volX: x,
      volY: volTop + volH - volBarH,
      volH: Math.max(volBarH, 1),
      volW: Math.max(slot * 0.62, 1),
      up: bar.close >= bar.open,
      start: bar.start,
    };
  });

  const ticks = 4;
  const priceLabels = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = max - (range * i) / ticks;
    return { y: yIn(value, min, range, padT, priceH), text: formatPrice(value) };
  });

  const labels: Array<{ x: number; text: string }> = [];
  const step = Math.max(1, Math.floor(bars.length / 6));
  for (let i = 0; i < bars.length; i += step) {
    labels.push({ x: laid[i].wickX, text: formatTime(bars[i].start, periodSeconds) });
  }

  const overlays = studies.overlays.map((overlay) => ({
    id: overlay.id,
    className: overlay.className,
    points: polyline(overlay.values, xs, min, range, padT, priceH),
  }));

  const volSma = studies.volSma ? polyline(studies.volSma, xs, 0, maxVol, volTop, volH) : "";

  let rsi = null;
  if (studies.rsi) {
    rsi = {
      line: polyline(studies.rsi, xs, 0, 100, rsiTop, rsiH),
      labels: [
        { y: yIn(70, 0, 100, rsiTop, rsiH), text: "70" },
        { y: yIn(30, 0, 100, rsiTop, rsiH), text: "30" },
      ],
    };
  }

  let macd = null;
  if (studies.macd) {
    const vals = [...studies.macd.macd, ...studies.macd.signal, ...studies.macd.hist].filter(
      (v): v is number => v != null && Number.isFinite(v),
    );
    const lo = Math.min(0, ...vals, -1);
    const hi = Math.max(0, ...vals, 1);
    const macdRange = hi - lo || 1;
    macd = {
      line: polyline(studies.macd.macd, xs, lo, macdRange, macdTop, macdH),
      signal: polyline(studies.macd.signal, xs, lo, macdRange, macdTop, macdH),
      hist: studies.macd.hist.map((value, i) => {
        const v = value ?? 0;
        const zero = yIn(0, lo, macdRange, macdTop, macdH);
        const y = yIn(v, lo, macdRange, macdTop, macdH);
        return {
          x: padL + i * slot,
          y: Math.min(zero, y),
          h: Math.max(Math.abs(zero - y), 1),
          w: Math.max(slot * 0.5, 1),
          up: v >= 0,
        };
      }),
      labels: [{ y: yIn(0, lo, macdRange, macdTop, macdH), text: "0" }],
    };
  }

  return { width, height, padL, min, max, bars: laid, labels, priceLabels, overlays, volSma, rsi, macd };
}

export function formatPrice(value: number): string {
  if (value >= 1000) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export function formatTime(start: number, periodSeconds = 300): string {
  const date = new Date(start * 1000);
  if (periodSeconds >= 86400) {
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
  }
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
