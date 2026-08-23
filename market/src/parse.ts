export type Ticker = {
  product_id: string;
  price?: string;
  volume_24_h?: string;
  low_24_h?: string;
  high_24_h?: string;
  price_percent_chg_24_h?: string;
  best_bid?: string;
  best_ask?: string;
  best_bid_quantity?: string;
  best_ask_quantity?: string;
};

export type Trade = {
  trade_id?: string;
  product_id: string;
  price: string;
  size: string;
  side: string;
  time?: string;
};

export type Candle = {
  start: string;
  high: string;
  low: string;
  open: string;
  close: string;
  volume: string;
  product_id: string;
};

export type ProductStatus = {
  product_id: string;
  id?: string;
  status?: string;
  trading_disabled?: boolean;
  product_type?: string;
  base_increment?: string;
  quote_increment?: string;
};

export type FiveMinuteCandle = {
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OhlcBar = FiveMinuteCandle;

export const RAW_CANDLE_LIMIT = 1440;
export const FIVE_MINUTE_LIMIT = 72;
export const CANDLE_PAGE = 300;
export const CANDLES_URL = "/coinbase-api/api/v3/brokerage/market/products";

type FeedPayload = {
  channel?: string;
  type?: string;
  message?: string;
  reason?: string;
  events?: Array<{
    type?: string;
    tickers?: Ticker[];
    trades?: Trade[];
    candles?: Candle[];
    products?: ProductStatus[];
  }>;
};

export function feedError(payload: FeedPayload): string | null {
  if (payload.type === "error") {
    return "Coinbase rejected the market feed request.";
  }
  return null;
}

export function applyTickers(map: Record<string, Ticker>, payload: FeedPayload): boolean {
  if (payload.channel !== "ticker" && payload.channel !== "ticker_batch") return false;
  for (const event of payload.events || []) {
    for (const ticker of event.tickers || []) {
      if (ticker.product_id) map[ticker.product_id] = ticker;
    }
  }
  return true;
}

export function applyTrades(list: Trade[], payload: FeedPayload, limit = 24): boolean {
  if (payload.channel !== "market_trades") return false;
  for (const event of payload.events || []) {
    for (const trade of event.trades || []) {
      list.unshift(trade);
    }
  }
  if (list.length > limit) list.length = limit;
  return true;
}

export function applyRawCandles(map: Record<string, Candle[]>, payload: FeedPayload): boolean {
  if (payload.channel !== "candles") return false;
  for (const event of payload.events || []) {
    for (const candle of event.candles || []) {
      if (!candle.product_id) continue;
      const rows = map[candle.product_id] || [];
      const index = rows.findIndex((row) => row.start === candle.start);
      if (index >= 0) rows[index] = candle;
      else rows.push(candle);
      rows.sort((a, b) => Number(a.start) - Number(b.start));
      map[candle.product_id] = rows.slice(-RAW_CANDLE_LIMIT);
    }
  }
  return true;
}

export function toFiveMinuteCandles(rows: Candle[]): FiveMinuteCandle[] {
  return bucketCandles(rows, 300, FIVE_MINUTE_LIMIT);
}

export function bucketCandles(
  rows: Array<Candle | OhlcBar>,
  periodSeconds: number,
  limit = 400,
): OhlcBar[] {
  const period = Math.max(1, periodSeconds);
  const buckets = new Map<number, OhlcBar>();
  for (const row of rows) {
    const start = Number(row.start);
    if (!Number.isFinite(start)) continue;
    const bucket = Math.floor(start / period) * period;
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    const volume = Number(row.volume);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { start: bucket, open, high, low, close, volume: volume || 0 });
      continue;
    }
    existing.high = Math.max(existing.high, high);
    existing.low = Math.min(existing.low, low);
    existing.close = close;
    existing.volume += volume || 0;
  }
  return [...buckets.values()].sort((a, b) => a.start - b.start).slice(-limit);
}

export function mergeFiveMinuteBars(
  history: FiveMinuteCandle[],
  live: FiveMinuteCandle[],
  limit = FIVE_MINUTE_LIMIT,
): FiveMinuteCandle[] {
  const byStart = new Map<number, FiveMinuteCandle>();
  for (const bar of history) byStart.set(bar.start, bar);
  for (const bar of live) byStart.set(bar.start, bar);
  return [...byStart.values()].sort((a, b) => a.start - b.start).slice(-limit);
}

export function asFiveMinuteCandle(row: {
  start?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
}): FiveMinuteCandle | null {
  const start = Number(row.start);
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = Number(row.volume);
  if (![start, open, high, low, close].every(Number.isFinite)) return null;
  return { start, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 };
}

export async function fetchFiveMinuteHistory(
  productId: string,
  limit = FIVE_MINUTE_LIMIT,
  fetcher: typeof fetch = fetch,
): Promise<FiveMinuteCandle[]> {
  const end = Math.floor(Date.now() / 1000);
  return fetchCandleHistory({
    productId,
    granularity: "FIVE_MINUTE",
    start: end - limit * 300,
    end,
    fetcher,
  });
}

export async function fetchCandleHistory(options: {
  productId: string;
  granularity: string;
  start: number;
  end: number;
  fetcher?: typeof fetch;
}): Promise<OhlcBar[]> {
  const fetcher = options.fetcher || fetch;
  const found = new Map<number, OhlcBar>();
  let cursorEnd = options.end;
  for (let page = 0; page < 8; page += 1) {
    const url = new URL(`${CANDLES_URL}/${encodeURIComponent(options.productId)}/candles`, "http://local");
    url.searchParams.set("granularity", options.granularity);
    url.searchParams.set("start", String(options.start));
    url.searchParams.set("end", String(cursorEnd));
    url.searchParams.set("limit", String(CANDLE_PAGE));
    const response = await fetcher(`${CANDLES_URL}/${encodeURIComponent(options.productId)}/candles${url.search}`);
    if (!response.ok) throw new Error(`candles HTTP ${response.status}`);
    const data = (await response.json()) as { candles?: Array<Record<string, string>> };
    const pageBars = (data.candles || [])
      .map((row) => asFiveMinuteCandle(row))
      .filter((bar): bar is OhlcBar => bar !== null);
    if (!pageBars.length) break;
    for (const bar of pageBars) found.set(bar.start, bar);
    const oldest = Math.min(...pageBars.map((bar) => bar.start));
    if (oldest <= options.start || pageBars.length < CANDLE_PAGE) break;
    cursorEnd = oldest - 1;
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}

export function applyStatus(map: Record<string, ProductStatus>, payload: FeedPayload): boolean {
  if (payload.channel !== "status") return false;
  for (const event of payload.events || []) {
    for (const product of event.products || []) {
      const id = product.product_id || product.id;
      if (!id) continue;
      map[id] = { ...product, product_id: id };
    }
  }
  return true;
}
