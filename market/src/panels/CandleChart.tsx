import { useMemo } from "react";
import { layoutCandleChart } from "../chart";
import { mergeFiveMinuteBars, toFiveMinuteCandles, type Candle, type FiveMinuteCandle } from "../parse";

export function CandleChart({
  productId,
  raw,
  history,
}: {
  productId: string;
  raw: Record<string, Candle[]>;
  history: Record<string, FiveMinuteCandle[]>;
}) {
  const bars = useMemo(
    () => mergeFiveMinuteBars(history[productId] || [], toFiveMinuteCandles(raw[productId] || [])),
    [history, raw, productId],
  );
  const last = bars.at(-1);
  const up = last ? last.close >= last.open : true;
  const layout = useMemo(() => layoutCandleChart(bars), [bars]);

  return (
    <section className="panel candle-chart">
      <div className="chart-head">
        <h2>5-minute · {productId}</h2>
        {last && (
          <p className={`candle ${up ? "bid" : "ask"}`}>
            o {last.open.toFixed(2)} · h {last.high.toFixed(2)} · l {last.low.toFixed(2)} · c{" "}
            {last.close.toFixed(2)} · v {last.volume.toFixed(4)}
          </p>
        )}
      </div>
      {bars.length === 0 ? (
        <p className="empty">Waiting for the first candle…</p>
      ) : (
        <svg className="chart" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
          {layout.priceLabels.map((label) => (
            <g key={label.text}>
              <line
                x1={layout.padL}
                x2={layout.width}
                y1={label.y}
                y2={label.y}
                className="grid"
              />
              <text x={4} y={label.y + 4} className="axis">
                {label.text}
              </text>
            </g>
          ))}
          {layout.bars.map((bar) => (
            <g key={bar.start}>
              <line
                x1={bar.wickX}
                x2={bar.wickX}
                y1={bar.highY}
                y2={bar.lowY}
                className={bar.up ? "wick up" : "wick down"}
              />
              <rect
                x={bar.x}
                y={bar.bodyY}
                width={bar.bodyWidth}
                height={bar.bodyH}
                className={bar.up ? "body up" : "body down"}
              />
              <rect
                x={bar.volX}
                y={bar.volY}
                width={bar.volW}
                height={bar.volH}
                className={bar.up ? "vol up" : "vol down"}
              />
            </g>
          ))}
          {layout.labels.map((label) => (
            <text key={label.text + label.x} x={label.x} y={layout.height - 4} className="axis time">
              {label.text}
            </text>
          ))}
        </svg>
      )}
    </section>
  );
}
