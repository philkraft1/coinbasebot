import type { OhlcBar, Ticker } from "./parse.ts";

export type LandingQuote = {
  productId: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  changePct: number | null;
  volume: number | null;
  volume24h: number | null;
  avgVolume: number | null;
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildQuote(productId: string, ticker: Ticker | undefined, bars: OhlcBar[]): LandingQuote {
  const last = bars.at(-1);
  const close = num(ticker?.price) ?? last?.close ?? null;
  const changePct = num(ticker?.price_percent_chg_24_h);
  const openFromChange = close != null && changePct != null ? close / (1 + changePct / 100) : null;
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  return {
    productId,
    open: openFromChange ?? bars[0]?.open ?? null,
    high: num(ticker?.high_24_h) ?? (highs.length ? Math.max(...highs) : null),
    low: num(ticker?.low_24_h) ?? (lows.length ? Math.min(...lows) : null),
    close,
    changePct,
    volume: last?.volume ?? null,
    volume24h: num(ticker?.volume_24_h),
    avgVolume: bars.length ? bars.reduce((sum, bar) => sum + bar.volume, 0) / bars.length : null,
  };
}

export function formatPrice(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export function formatVolume(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function applyTickerToLastBar(bars: OhlcBar[], ticker?: Ticker): OhlcBar[] {
  const price = num(ticker?.price);
  if (!bars.length || price == null) return bars;
  const last = bars[bars.length - 1];
  if (last.close === price && last.high >= price && last.low <= price) return bars;
  return [
    ...bars.slice(0, -1),
    {
      ...last,
      close: price,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
    },
  ];
}

export function formatChange(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
