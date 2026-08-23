import { toFiveMinuteCandles, type Candle } from "../parse";

export function CandleStrip({ productId, raw }: { productId: string; raw: Record<string, Candle[]> }) {
  const last = toFiveMinuteCandles(raw[productId] || []).at(-1);
  return (
    <section className="panel candle-strip">
      <h2>5-minute · {productId}</h2>
      {last ? (
        <p className="candle">
          o {last.open.toFixed(2)} · h {last.high.toFixed(2)} · l {last.low.toFixed(2)} · c{" "}
          {last.close.toFixed(2)} · v {last.volume.toFixed(4)}
        </p>
      ) : (
        <p className="empty">Waiting for the first candle…</p>
      )}
    </section>
  );
}
