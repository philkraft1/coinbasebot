import { useEffect, useMemo, useRef, useState } from "react";
import { createFeedTracker, formatGap, type HeartbeatTick, type SequenceGap } from "./feed";
import {
  DEFAULT_PRODUCTS,
  OPTIONAL_PRODUCT,
  WS_URL,
  applyLevel2Message,
  emptyBooks,
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
  toFiveMinuteCandles,
  type Candle,
  type ProductStatus,
  type Ticker,
  type Trade,
} from "./parse";

type Status = "connecting" | "live" | "error";

const PUBLIC_CHANNELS = ["ticker", "market_trades", "candles", "status", "level2"] as const;

function BookPanel({
  productId,
  bids,
  asks,
  stale,
}: {
  productId: string;
  bids: ReturnType<typeof topLevels>;
  asks: ReturnType<typeof topLevels>;
  stale: boolean;
}) {
  const bestBid = bids[0] ? Number(bids[0].price) : null;
  const bestAsk = asks[0] ? Number(asks[0].price) : null;
  const spread =
    bestBid !== null && bestAsk !== null ? (bestAsk - bestBid).toFixed(2) : "—";

  if (bids.length === 0 && asks.length === 0) {
    return (
      <section className="panel">
        <h2>{productId}</h2>
        <p className="empty">
          {stale
            ? "Sequence gap — waiting for a fresh level2 snapshot…"
            : "Waiting for the first level2 snapshot…"}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>
        {productId} <span className="spread">spread {spread}</span>
        {stale && <span className="warn"> stale — resubscribed</span>}
      </h2>
      <table>
        <thead>
          <tr>
            <th>Bid</th>
            <th>Size</th>
            <th>Ask</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(bids.length, asks.length) }, (_, i) => (
            <tr key={i}>
              <td className="bid">{bids[i]?.price ?? ""}</td>
              <td>{bids[i] ? bids[i].quantity.toFixed(6) : ""}</td>
              <td className="ask">{asks[i]?.price ?? ""}</td>
              <td>{asks[i] ? asks[i].quantity.toFixed(6) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TickerPanel({ products, tickers }: { products: string[]; tickers: Record<string, Ticker> }) {
  const rows = products.map((id) => tickers[id]).filter(Boolean);
  return (
    <section className="panel compact">
      <h2>Ticker</h2>
      {rows.length === 0 ? (
        <p className="empty">Waiting for the first ticker…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>24h</th>
              <th>Bid</th>
              <th>Ask</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id}>
                <td>{row.product_id}</td>
                <td>{row.price ?? "—"}</td>
                <td>{row.price_percent_chg_24_h ? `${row.price_percent_chg_24_h}%` : "—"}</td>
                <td className="bid">{row.best_bid ?? "—"}</td>
                <td className="ask">{row.best_ask ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TradesPanel({ trades }: { trades: Trade[] }) {
  return (
    <section className="panel compact">
      <h2>Market trades</h2>
      {trades.length === 0 ? (
        <p className="empty">No trades yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Side</th>
              <th>Size</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 10).map((trade, index) => (
              <tr key={`${trade.trade_id ?? trade.time ?? index}`}>
                <td>{trade.product_id}</td>
                <td className={trade.side === "BUY" || trade.side === "buy" ? "bid" : "ask"}>
                  {trade.side}
                </td>
                <td>{trade.size}</td>
                <td>{trade.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CandlesPanel({
  products,
  raw,
}: {
  products: string[];
  raw: Record<string, Candle[]>;
}) {
  return (
    <section className="panel compact">
      <h2>5-minute candles</h2>
      {products.every((id) => !raw[id]?.length) ? (
        <p className="empty">Waiting for the first candle…</p>
      ) : (
        <div className="stack">
          {products.map((id) => {
            const bars = toFiveMinuteCandles(raw[id] || []);
            const last = bars.at(-1);
            if (!last) {
              return (
                <p key={id} className="muted">
                  {id}: no bars yet
                </p>
              );
            }
            return (
              <p key={id} className="candle">
                <strong>{id}</strong> o {last.open.toFixed(2)} h {last.high.toFixed(2)} l{" "}
                {last.low.toFixed(2)} c {last.close.toFixed(2)} v {last.volume.toFixed(4)}
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusPanel({
  products,
  statuses,
}: {
  products: string[];
  statuses: Record<string, ProductStatus>;
}) {
  const rows = products.map((id) => statuses[id]).filter(Boolean);
  return (
    <section className="panel compact">
      <h2>Product status</h2>
      {rows.length === 0 ? (
        <p className="empty">Waiting for product status…</p>
      ) : (
        <ul className="status-list">
          {rows.map((row) => (
            <li key={row.product_id}>
              <strong>{row.product_id}</strong> {row.status ?? "unknown"}
              {row.trading_disabled ? " · trading disabled" : ""}
              {row.product_type ? ` · ${row.product_type}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function App() {
  const [includeBtc, setIncludeBtc] = useState(false);
  const products = useMemo(
    () => (includeBtc ? [...DEFAULT_PRODUCTS, OPTIONAL_PRODUCT] : [...DEFAULT_PRODUCTS]),
    [includeBtc],
  );

  const booksRef = useRef<Record<string, Book>>(emptyBooks(products));
  const tickersRef = useRef<Record<string, Ticker>>({});
  const tradesRef = useRef<Trade[]>([]);
  const candlesRef = useRef<Record<string, Candle[]>>({});
  const statusRef = useRef<Record<string, ProductStatus>>({});
  const trackerRef = useRef(createFeedTracker());
  const lastResubscribe = useRef(0);

  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatTick | null>(null);
  const [gaps, setGaps] = useState<SequenceGap[]>([]);
  const [staleBook, setStaleBook] = useState(false);
  const [sequences, setSequences] = useState<Record<string, number>>({});

  useEffect(() => {
    booksRef.current = emptyBooks(products);
    tickersRef.current = {};
    tradesRef.current = [];
    candlesRef.current = {};
    statusRef.current = {};
    trackerRef.current = createFeedTracker();
    setHeartbeat(null);
    setGaps([]);
    setStaleBook(false);
    setSequences({});
    setStatus("connecting");
    setError(null);
    setTick((n) => n + 1);

    const ws = new WebSocket(WS_URL);
    let closed = false;

    const sendSubscribe = (channel: string) => {
      ws.send(JSON.stringify(subscribeMessage(channel, products)));
    };

    const resubscribeLevel2 = () => {
      const now = Date.now();
      if (now - lastResubscribe.current < 2000) return;
      lastResubscribe.current = now;
      setStaleBook(true);
      ws.send(JSON.stringify(unsubscribeMessage("level2", products)));
      trackerRef.current.reset("l2_data");
      booksRef.current = emptyBooks(products);
      sendSubscribe("level2");
      setTick((n) => n + 1);
    };

    ws.onopen = () => {
      sendSubscribe("heartbeats");
      for (const channel of PUBLIC_CHANNELS) sendSubscribe(channel);
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
        setGaps((prev) => [...observed.gaps, ...prev].slice(0, 8));
      }
      setSequences(trackerRef.current.snapshot().sequences);
      if (observed.resubscribeLevel2) resubscribeLevel2();

      let changed = false;
      changed = applyTickers(tickersRef.current, payload) || changed;
      changed = applyTrades(tradesRef.current, payload) || changed;
      changed = applyRawCandles(candlesRef.current, payload) || changed;
      changed = applyStatus(statusRef.current, payload) || changed;
      const bookResult = applyLevel2Message(booksRef.current, payload);
      if (bookResult.error) {
        setError(bookResult.error);
        setStatus("error");
        return;
      }
      if (bookResult.changed) {
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
      ws.close();
    };
  }, [products]);

  const views = useMemo(() => {
    void tick;
    return products.map((id) => ({
      id,
      bids: topLevels(booksRef.current[id]?.bids ?? new Map(), true),
      asks: topLevels(booksRef.current[id]?.asks ?? new Map(), false),
    }));
  }, [tick, products]);

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

  const subscribePreview = JSON.stringify(subscribeMessage("ticker", products), null, 2);
  const heartbeatPreview = JSON.stringify(subscribeMessage("heartbeats", products), null, 2);

  return (
    <main>
      <h1>Coinbase Advanced Trade — public market feed</h1>
      <p>
        Live public channels from <code>wss://advanced-trade-ws.coinbase.com</code>. Heartbeats
        are always paired so sparse books stay open. No CDP private key is used in the browser.
        <code> user</code> and <code>futures_balance_summary</code> stay on{" "}
        <code>npm run ws -- --channel user</code>.
      </p>
      <div className="status">
        <span>
          <span className={`dot ${status === "live" ? "live" : status === "error" ? "err" : "wait"}`} />
          {status === "connecting" && "Connecting…"}
          {status === "live" && `Subscribed to ${products.join(", ")}`}
          {status === "error" && "Disconnected"}
        </span>
        <span className="muted">
          heartbeat {heartbeat ? `#${heartbeat.counter}` : "waiting…"}
        </span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={includeBtc}
            onChange={(event) => setIncludeBtc(event.target.checked)}
          />
          Include BTC-USD
        </label>
      </div>
      <section className="panel compact seq">
        <h2>Sequence / heartbeat</h2>
        {status === "connecting" ? (
          <p className="empty">Waiting for the first frame…</p>
        ) : (
          <>
            <p className="muted">
              {Object.entries(sequences).length
                ? Object.entries(sequences)
                    .map(([channel, num]) => `${channel} #${num}`)
                    .join(" · ")
                : "No sequence numbers yet."}
            </p>
            {gaps.length > 0 ? (
              <ul className="status-list">
                {gaps.map((gap, index) => (
                  <li key={`${gap.channel}-${gap.received}-${index}`} className="warn">
                    {formatGap(gap)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No sequence or heartbeat gaps.</p>
            )}
          </>
        )}
      </section>
      {error && (
        <section className="panel error">
          <strong>Could not keep the feed in sync.</strong>
          <p>{error}</p>
        </section>
      )}
      <div className="row triple">
        <TickerPanel products={products} tickers={tickers} />
        <TradesPanel trades={trades} />
        <CandlesPanel products={products} raw={candles} />
      </div>
      <div className="row">
        <StatusPanel products={products} statuses={statuses} />
      </div>
      <div className="row">
        {views.map((book) => (
          <BookPanel
            key={book.id}
            productId={book.id}
            bids={book.bids}
            asks={book.asks}
            stale={staleBook}
          />
        ))}
      </div>
      <section className="panel" style={{ marginTop: 16, minHeight: 0 }}>
        <h2>Subscribe messages</h2>
        <p className="muted">
          Heartbeats are <code>{heartbeatPreview}</code> — no <code>product_ids</code>. Public
          channels look like:
        </p>
        <pre>
          <code>{subscribePreview}</code>
        </pre>
      </section>
    </main>
  );
}
