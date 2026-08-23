import { useEffect, useMemo, useRef, useState } from "react";
import { LANDING_PRODUCTS } from "./landingExamples";
import { buildQuote, type LandingQuote } from "./landingQuotes";
import { subscribeMessage, WS_URL } from "./level2";
import {
  applyRawCandles,
  applyTickers,
  bucketCandles,
  fetchFiveMinuteHistory,
  mergeFiveMinuteBars,
  type Candle,
  type OhlcBar,
  type Ticker,
} from "./parse";

export function useLandingQuotes(): { quotes: LandingQuote[]; status: "connecting" | "live" | "error" } {
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [tick, setTick] = useState(0);
  const historyRef = useRef<Record<string, OhlcBar[]>>({});
  const liveRef = useRef<Record<string, Candle[]>>({});
  const tickersRef = useRef<Record<string, Ticker>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      LANDING_PRODUCTS.map(async (productId) => {
        const bars = await fetchFiveMinuteHistory(productId);
        return [productId, bars] as const;
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        historyRef.current = Object.fromEntries(rows);
        setTick((n) => n + 1);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    let closed = false;

    ws.onopen = () => {
      ws.send(JSON.stringify(subscribeMessage("heartbeats", LANDING_PRODUCTS)));
      ws.send(JSON.stringify(subscribeMessage("ticker", LANDING_PRODUCTS)));
      ws.send(JSON.stringify(subscribeMessage("candles", LANDING_PRODUCTS)));
      setStatus("live");
    };

    ws.onmessage = (event) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const tickersChanged = applyTickers(tickersRef.current, payload);
      const candlesChanged = applyRawCandles(liveRef.current, payload);
      if (tickersChanged || candlesChanged) setTick((n) => n + 1);
    };

    ws.onerror = () => {
      if (!closed) setStatus("error");
    };

    ws.onclose = () => {
      if (!closed) setStatus((prev) => (prev === "live" ? "error" : prev));
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, []);

  return useMemo(() => {
    void tick;
    const quotes = LANDING_PRODUCTS.map((productId) => {
      const live = mergeFiveMinuteBars(
        historyRef.current[productId] || [],
        bucketCandles(liveRef.current[productId] || [], 300),
      );
      return buildQuote(productId, tickersRef.current[productId], live);
    });
    return { quotes, status };
  }, [tick, status]);
}
