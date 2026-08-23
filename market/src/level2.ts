export const WS_URL = "wss://advanced-trade-ws.coinbase.com";
export const DEFAULT_PRODUCTS = ["ETH-USD", "ETH-EUR"] as const;
export const OPTIONAL_PRODUCT = "BTC-USD";

export type BookSide = Map<string, number>;

export type Book = {
  bids: BookSide;
  asks: BookSide;
};

export type Level = {
  price: string;
  quantity: number;
};

export function emptyBook(): Book {
  return { bids: new Map(), asks: new Map() };
}

export function emptyBooks(products: string[]): Record<string, Book> {
  return Object.fromEntries(products.map((id) => [id, emptyBook()]));
}

export function subscribeMessage(channel: string, products: string[], jwt?: string) {
  const message: {
    type: "subscribe" | "unsubscribe";
    channel: string;
    product_ids?: string[];
    jwt?: string;
  } = {
    type: "subscribe",
    channel,
  };
  if (channel !== "heartbeats") message.product_ids = [...products];
  if (jwt && jwt !== "exampleJWT" && jwt !== "XYZ") message.jwt = jwt;
  return message;
}

export function unsubscribeMessage(channel: string, products: string[]) {
  const message: {
    type: "unsubscribe";
    channel: string;
    product_ids?: string[];
  } = {
    type: "unsubscribe",
    channel,
  };
  if (channel !== "heartbeats") message.product_ids = [...products];
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
  books: Record<string, Book>,
  payload: { channel?: string; events?: Event[] },
): { changed: boolean; error?: string } {
  if (payload.channel !== "l2_data" || !Array.isArray(payload.events)) {
    return { changed: false };
  }

  let changed = false;
  for (const item of payload.events) {
    if (!item.product_id || !books[item.product_id]) continue;
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
