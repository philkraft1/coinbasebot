import type { OhlcBar } from "./parse.ts";

export type LandingExample = {
  productId: string;
  name: string;
  interval: string;
  last: number;
  changePct: number;
  bars: OhlcBar[];
};

const SPECS = [
  { productId: "BTC-USD", name: "Bitcoin", seed: 11, start: 68_400, step: 180 },
  { productId: "ETH-USD", name: "Ethereum", seed: 23, start: 3_420, step: 14 },
  { productId: "SOL-USD", name: "Solana", seed: 37, start: 168, step: 1.4 },
  { productId: "LINK-USD", name: "Chainlink", seed: 41, start: 18.4, step: 0.12 },
] as const;

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function demoBars(seed: number, startPrice: number, step: number, count = 36): OhlcBar[] {
  const rand = rng(seed);
  const origin = 1_777_200_000;
  const bars: OhlcBar[] = [];
  let close = startPrice;
  for (let i = 0; i < count; i += 1) {
    const drift = (rand() - 0.46) * step;
    const open = close;
    close = Math.max(0.01, open + drift);
    const wick = step * (0.25 + rand() * 0.55);
    const high = Math.max(open, close) + wick * rand();
    const low = Math.min(open, close) - wick * rand();
    bars.push({
      start: origin + i * 300,
      open,
      high,
      low,
      close,
      volume: 8 + rand() * 40,
    });
  }
  return bars;
}

export function landingExamples(): LandingExample[] {
  return SPECS.map((spec) => {
    const bars = demoBars(spec.seed, spec.start, spec.step);
    const first = bars[0].open;
    const last = bars[bars.length - 1].close;
    return {
      productId: spec.productId,
      name: spec.name,
      interval: "5m",
      last,
      changePct: ((last - first) / first) * 100,
      bars,
    };
  });
}
