import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCT_IDS,
  WS_URL,
  applyLevel2Message,
  emptyBooks,
  subscribeMessage,
  topLevels,
  type ProductId,
} from "./level2";

type Status = "connecting" | "live" | "error";

function BookPanel({
  productId,
  bids,
  asks,
}: {
  productId: ProductId;
  bids: ReturnType<typeof topLevels>;
  asks: ReturnType<typeof topLevels>;
}) {
  const bestBid = bids[0] ? Number(bids[0].price) : null;
  const bestAsk = asks[0] ? Number(asks[0].price) : null;
  const spread =
    bestBid !== null && bestAsk !== null ? (bestAsk - bestBid).toFixed(2) : "—";

  if (bids.length === 0 && asks.length === 0) {
    return (
      <section className="panel">
        <h2>{productId}</h2>
        <p className="empty">Waiting for the first level2 snapshot…</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>
        {productId} <span className="spread">spread {spread}</span>
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

export function App() {
  const booksRef = useRef(emptyBooks());
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    const jwt = "";

    ws.onopen = () => {
      ws.send(JSON.stringify(subscribeMessage("level2", jwt)));
      ws.send(JSON.stringify(subscribeMessage("heartbeats", jwt)));
      setStatus("live");
      setError(null);
    };

    ws.onmessage = (event) => {
      const result = applyLevel2Message(booksRef.current, String(event.data));
      if (result.error) {
        setError(result.error);
        setStatus("error");
        return;
      }
      if (result.changed) setTick((n) => n + 1);
    };

    ws.onerror = () => {
      setStatus("error");
      setError("The Coinbase WebSocket failed. Check the network and reload.");
    };

    ws.onclose = (event) => {
      if (event.code !== 1000) {
        setStatus("error");
        setError(`Socket closed (${event.code}). Reload to subscribe again.`);
      }
    };

    return () => ws.close();
  }, []);

  const views = useMemo(() => {
    void tick;
    return PRODUCT_IDS.map((id) => ({
      id,
      bids: topLevels(booksRef.current[id].bids, true),
      asks: topLevels(booksRef.current[id].asks, false),
    }));
  }, [tick]);

  const subscribePreview = JSON.stringify(subscribeMessage("level2"), null, 2);

  return (
    <main>
      <h1>ETH level2 — Coinbase Advanced Trade</h1>
      <p>
        Live order book from <code>wss://advanced-trade-ws.coinbase.com</code>.
        The docs sample includes <code>"jwt": "exampleJWT"</code>. That string is
        not sent. level2 is public; add a real CDP JWT only if you generate one.
      </p>
      <div className="status">
        <span>
          <span className={`dot ${status === "live" ? "live" : status === "error" ? "err" : "wait"}`} />
          {status === "connecting" && "Connecting…"}
          {status === "live" && "Subscribed to ETH-USD and ETH-EUR"}
          {status === "error" && "Disconnected"}
        </span>
      </div>
      {error && (
        <section className="panel error">
          <strong>Could not keep the book in sync.</strong>
          <p>{error}</p>
        </section>
      )}
      <div className="row">
        {views.map((book) => (
          <BookPanel key={book.id} productId={book.id} bids={book.bids} asks={book.asks} />
        ))}
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Subscribe message</h2>
        <pre>
          <code>{subscribePreview}</code>
        </pre>
      </section>
    </main>
  );
}
