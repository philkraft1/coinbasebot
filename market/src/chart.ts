import type { FiveMinuteCandle } from "./parse";

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

export type ChartLayout = {
  width: number;
  height: number;
  padL: number;
  min: number;
  max: number;
  bars: CandleLayout[];
  labels: Array<{ x: number; text: string }>;
  priceLabels: Array<{ y: number; text: string }>;
};

function yPrice(value: number, min: number, range: number, padT: number, priceH: number) {
  return padT + (1 - (value - min) / range) * priceH;
}

export function layoutCandleChart(
  bars: FiveMinuteCandle[],
  width = 1000,
  height = 400,
): ChartLayout {
  const padL = 64;
  const padR = 12;
  const padT = 10;
  const labelH = 18;
  const priceH = height * 0.7 - padT;
  const volTop = padT + priceH + 10;
  const volH = Math.max(height - volTop - labelH, 8);
  const innerW = Math.max(width - padL - padR, 1);

  if (bars.length === 0) {
    return { width, height, padL, min: 0, max: 1, bars: [], labels: [], priceLabels: [] };
  }

  let min = Math.min(...bars.map((bar) => bar.low));
  let max = Math.max(...bars.map((bar) => bar.high));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) max = min + 1;
  const range = max - min;
  const maxVol = Math.max(...bars.map((bar) => bar.volume), 1);
  const slot = innerW / bars.length;

  const laid = bars.map((bar, index) => {
    const x = padL + index * slot;
    const top = yPrice(Math.max(bar.open, bar.close), min, range, padT, priceH);
    const bottom = yPrice(Math.min(bar.open, bar.close), min, range, padT, priceH);
    const volBarH = (bar.volume / maxVol) * volH;
    return {
      x,
      bodyWidth: Math.max(slot * 0.62, 1),
      wickX: x + slot * 0.31,
      bodyY: top,
      bodyH: Math.max(bottom - top, 1),
      highY: yPrice(bar.high, min, range, padT, priceH),
      lowY: yPrice(bar.low, min, range, padT, priceH),
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
    return { y: yPrice(value, min, range, padT, priceH), text: formatPrice(value) };
  });

  const labels: Array<{ x: number; text: string }> = [];
  const step = Math.max(1, Math.floor(bars.length / 6));
  for (let i = 0; i < bars.length; i += step) {
    const bar = laid[i];
    labels.push({ x: bar.wickX, text: formatTime(bars[i].start) });
  }

  return { width, height, padL, min, max, bars: laid, labels, priceLabels };
}

export function formatPrice(value: number): string {
  if (value >= 1000) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export function formatTime(start: number): string {
  const date = new Date(start * 1000);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
