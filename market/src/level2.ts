export const WS_URL = "wss://advanced-trade-ws.coinbase.com";
export const PRODUCT_IDS = ["ETH-USD", "ETH-EUR"] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

export type BookSide = Map<string, number>;

export type Book = {
  bids: BookSide;
  asks: BookSide;
};

export type Level = {
  price: string;
  quantity: number;
};

export function emptyBooks(): Record<ProductId, Book> {
  return {
    "ETH-USD": { bids: new Map(), asks: new Map() },
    "ETH-EUR": { bids: new Map(), asks: new Map() },
  };
}

export function subscribeMessage(channel: string, jwt?: string) {
  const message: {
    type: "subscribe";
    product_ids: string[];
    channel: string;
    jwt?: string;
  } = {
    type: "subscribe",
    product_ids: [...PRODUCT_IDS],
    channel,
  };
  if (jwt && jwt !== "exampleJWT") message.jwt = jwt;
  return message;
}

type Update = {
  side?: string;
  price_level?: string;
  new_quantity?: string;
};

type Event = {
  type?: string;
  product_id?: string;
  updates?: Update[];
};

export function applyLevel2Message(
  books: Record<ProductId, Book>,
  raw: string,
): { changed: boolean; error?: string } {
  let payload: { channel?: string; events?: Event[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return { changed: false, error: "Coinbase sent a non-JSON frame." };
  }
  if (payload.channel !== "l2_data" || !Array.isArray(payload.events)) {
    return { changed: false };
  }

  let changed = false;
  for (const item of payload.events) {
    if (item.product_id !== "ETH-USD" && item.product_id !== "ETH-EUR") continue;
    const book = books[item.product_id];
    if (item.type === "snapshot") {
      book.bids = new Map();
      book.asks = new Map();
      changed = true;
    }
    for (const update of item.updates || []) {
      if (!update.price_level) continue;
      const side = update.side === "bid" ? book.bids : book.asks;
      const qty = Number(update.new_quantity);
      if (!Number.isFinite(qty) || qty === 0) side.delete(update.price_level);
      else side.set(update.price_level, qty);
      changed = true;
    }
  }
  return { changed };
}

export function topLevels(side: BookSide, descending: boolean, count = 12): Level[] {
  return [...side.entries()]
    .sort((a, b) => (descending ? Number(b[0]) - Number(a[0]) : Number(a[0]) - Number(b[0])))
    .slice(0, count)
    .map(([price, quantity]) => ({ price, quantity }));
}
