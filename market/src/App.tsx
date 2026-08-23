import { useEffect, useMemo, useRef, useState } from "react";
import { createFeedTracker, formatGap, type HeartbeatTick, type SequenceGap } from "./feed";
import {
  WS_URL,
  applyLevel2Message,
  emptyBook,
  subscribeMessage,
  topLevels,
  unsubscribeMessage,
  type Book,
} from "./level2";
import {
  applyRawCandles,
  applyStatus,
  applyTickers,
  applyTrades,
  feedError,
  type Candle,
  type ProductStatus,
  type Ticker,
  type Trade,
} from "./parse";
import { BookPanel } from "./panels/BookPanel";
import { CandleStrip } from "./panels/CandleStrip";
import { TradesPanel } from "./panels/TradesPanel";
import { Watchlist } from "./panels/Watchlist";
import { useTopUsdSpot } from "./useTopUsdSpot";

type Status = "connecting" | "live" | "error";

const PUBLIC_CHANNELS = ["ticker", "market_trades", "candles", "status"] as const;

export function App() {
  const { products, source } = useTopUsdSpot();
  const [focused, setFocused] = useState(products[0]);

  useEffect(() => {
    if (!products.includes(focused)) setFocused(products[0]);
  }, [products, focused]);

  const booksRef = useRef<Book>(emptyBook());
  const tickersRef = useRef<Record<string, Ticker>>({});
  const tradesRef = useRef<Trade[]>([]);
  const candlesRef = useRef<Record<string, Candle[]>>({});
  const statusRef = useRef<Record<string, ProductStatus>>({});
  const trackerRef = useRef(createFeedTracker());
  const lastResubscribe = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const focusedRef = useRef(focused);
  const prevFocusedRef = useRef<string | null>(null);
  focusedRef.current = focused;

  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatTick | null>(null);
  const [gaps, setGaps] = useState<SequenceGap[]>([]);
  const [staleBook, setStaleBook] = useState(false);

  useEffect(() => {
    tickersRef.current = {};
    tradesRef.current = [];
    candlesRef.current = {};
    statusRef.current = {};
    booksRef.current = emptyBook();
    trackerRef.current = createFeedTracker();
    setHeartbeat(null);
    setGaps([]);
    setStaleBook(false);
    setStatus("connecting");
    setError(null);
    setTick((n) => n + 1);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    let closed = false;

    const sendSubscribe = (channel: string, ids: string[]) => {
      ws.send(JSON.stringify(subscribeMessage(channel, ids)));
    };

    const resubscribeLevel2 = () => {
      const now = Date.now();
      if (now - lastResubscribe.current < 2000) return;
      lastResubscribe.current = now;
      const product = focusedRef.current;
      setStaleBook(true);
      ws.send(JSON.stringify(unsubscribeMessage("level2", [product])));
      trackerRef.current.reset("l2_data");
      booksRef.current = emptyBook();
      sendSubscribe("level2", [product]);
      setTick((n) => n + 1);
    };

    ws.onopen = () => {
      sendSubscribe("heartbeats", products);
      for (const channel of PUBLIC_CHANNELS) sendSubscribe(channel, products);
      sendSubscribe("level2", [focusedRef.current]);
      prevFocusedRef.current = focusedRef.current;
      setStatus("live");
      setError(null);
    };

    ws.onmessage = (event) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        setError("Coinbase sent a non-JSON frame.");
        setStatus("error");
        return;
      }

      const err = feedError(payload);
      if (err) {
        setError(err);
        setStatus("error");
        return;
      }

      const observed = trackerRef.current.observe(payload);
      if (observed.heartbeat) setHeartbeat(observed.heartbeat);
      if (observed.gaps.length) {
        setGaps((prev) => [...observed.gaps, ...prev].slice(0, 4));
      }
      if (observed.resubscribeLevel2) resubscribeLevel2();

      let changed = false;
      changed = applyTickers(tickersRef.current, payload) || changed;
      changed = applyTrades(tradesRef.current, payload, 80) || changed;
      changed = applyRawCandles(candlesRef.current, payload) || changed;
      changed = applyStatus(statusRef.current, payload) || changed;
      const bookMap = { [focusedRef.current]: booksRef.current };
      const bookResult = applyLevel2Message(bookMap, payload);
      if (bookResult.error) {
        setError(bookResult.error);
        setStatus("error");
        return;
      }
      if (bookResult.changed) {
        booksRef.current = bookMap[focusedRef.current];
        changed = true;
        setStaleBook(false);
      }
      if (changed) setTick((n) => n + 1);
    };

    ws.onerror = () => {
      if (closed) return;
      setStatus("error");
      setError("The Coinbase WebSocket failed. Check the network and reload.");
    };

    ws.onclose = (event) => {
      if (closed) return;
      if (event.code !== 1000) {
        setStatus("error");
        setError(`Socket closed (${event.code}). Reload to subscribe again.`);
      }
    };

    return () => {
      closed = true;
      if (wsRef.current === ws) wsRef.current = null;
      ws.close();
    };
  }, [products]);

  useEffect(() => {
    const ws = wsRef.current;
    const prev = prevFocusedRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (prev === focused) return;
    if (prev) ws.send(JSON.stringify(unsubscribeMessage("level2", [prev])));
    trackerRef.current.reset("l2_data");
    booksRef.current = emptyBook();
    setStaleBook(false);
    ws.send(JSON.stringify(subscribeMessage("level2", [focused])));
    prevFocusedRef.current = focused;
    setTick((n) => n + 1);
  }, [focused]);

  const book = useMemo(() => {
    void tick;
    return {
      bids: topLevels(booksRef.current.bids, true),
      asks: topLevels(booksRef.current.asks, false),
    };
  }, [tick]);

  const tickers = useMemo(() => {
    void tick;
    return { ...tickersRef.current };
  }, [tick]);

  const trades = useMemo(() => {
    void tick;
    return [...tradesRef.current];
  }, [tick]);

  const candles = useMemo(() => {
    void tick;
    return { ...candlesRef.current };
  }, [tick]);

  const statuses = useMemo(() => {
    void tick;
    return { ...statusRef.current };
  }, [tick]);

  const gapHint = gaps[0] ? formatGap(gaps[0]) : null;

  return (
    <div className="terminal">
      <header className="topbar">
        <div className="brand">
          <span className={`dot ${status === "live" ? "live" : status === "error" ? "err" : "wait"}`} />
          <strong>Coinbase</strong>
          <span className="muted">Top 10 USD spot · {source}</span>
        </div>
        <div className="meta">
          <span>{focused}</span>
          <span className="muted">heartbeat {heartbeat ? `#${heartbeat.counter}` : "waiting…"}</span>
          {staleBook && <span className="warn">book stale</span>}
          {gapHint && <span className="warn">{gapHint}</span>}
        </div>
      </header>
      {error && (
        <section className="banner error">
          <strong>Feed interrupted.</strong> {error}
        </section>
      )}
      <Watchlist
        products={products}
        focused={focused}
        tickers={tickers}
        statuses={statuses}
        onFocus={setFocused}
      />
      <CandleStrip productId={focused} raw={candles} />
      <div className="workspace">
        <TradesPanel productId={focused} trades={trades} />
        <BookPanel productId={focused} bids={book.bids} asks={book.asks} stale={staleBook} />
      </div>
    </div>
  );
}
