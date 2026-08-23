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
    return payload.message || payload.reason || "Coinbase returned an error frame.";
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
      map[candle.product_id] = rows.slice(-80);
    }
  }
  return true;
}

export function toFiveMinuteCandles(rows: Candle[]): FiveMinuteCandle[] {
  const buckets = new Map<number, FiveMinuteCandle>();
  for (const row of rows) {
    const start = Number(row.start);
    if (!Number.isFinite(start)) continue;
    const bucket = Math.floor(start / 300) * 300;
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    const volume = Number(row.volume);
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
  return [...buckets.values()].sort((a, b) => a.start - b.start).slice(-12);
}

export function applyStatus(map: Record<string, ProductStatus>, payload: FeedPayload): boolean {
  if (payload.channel !== "status") return false;
  for (const event of payload.events || []) {
    for (const product of event.products || []) {
      if (product.product_id) map[product.product_id] = product;
    }
  }
  return true;
}
