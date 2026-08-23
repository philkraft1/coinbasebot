import { Link } from "react-router-dom";
import { layoutCandleChart } from "../chart.ts";
import { LANDING_NAMES, LANDING_PRODUCTS } from "../landingExamples.ts";
import { formatChange, formatPrice, formatVolume } from "../landingQuotes.ts";
import type { OhlcBar } from "../parse.ts";
import { sma } from "../studies.ts";
import { useLandingQuotes } from "../useLandingQuotes.ts";

function MiniSpot({ bars }: { bars: OhlcBar[] }) {
  const closes = bars.map((bar) => bar.close);
  const layout = layoutCandleChart(bars, 420, 150, 60, {
    overlays: [{ id: "sma20", className: "sma20", values: sma(closes, 8) }],
    volSma: null,
    rsi: null,
    macd: null,
  });

  if (bars.length === 0) {
    return <p className="empty">Waiting for live candles…</p>;
  }

  return (
    <svg className="preview-chart" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
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
      {layout.overlays.map((line) =>
        line.points ? <polyline key={line.id} points={line.points} className={`overlay ${line.className}`} /> : null,
      )}
    </svg>
  );
}

export function LandingCharts() {
  const { quotes, charts, status } = useLandingQuotes();

  return (
    <section className="showcase">
      <div className="showcase-split">
        <table className="showcase-table">
          <caption>
            <span className={`dot ${status === "live" ? "live" : status === "error" ? "err" : "wait"}`} />
            Live spot charts
          </caption>
          <thead>
            <tr>
              <th>1m candles</th>
            </tr>
          </thead>
          <tbody>
            {LANDING_PRODUCTS.map((productId) => {
              const quote = quotes.find((row) => row.productId === productId);
              const up = (quote?.changePct ?? 0) >= 0;
              return (
                <tr key={productId}>
                  <td>
                    <Link className="preview-card" to="/spot">
                      <div className="preview-head">
                        <strong>{productId}</strong>
                        <span className={quote?.changePct == null ? "muted" : up ? "bid" : "ask"}>
                          {formatPrice(quote?.close ?? null)} {formatChange(quote?.changePct ?? null)}
                        </span>
                      </div>
                      <p className="muted hint">{LANDING_NAMES[productId]} · live 1m</p>
                      <MiniSpot bars={charts[productId] || []} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <table className="stats-table">
          <caption>
            <span className={`dot ${status === "live" ? "live" : status === "error" ? "err" : "wait"}`} />
            Live quotes
          </caption>
          <thead>
            <tr>
              <th>Pair</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
              <th>% Chg</th>
              <th>Vol</th>
              <th>24h Vol</th>
              <th>Avg Vol</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const up = (quote.changePct ?? 0) >= 0;
              return (
                <tr key={quote.productId}>
                  <td>
                    <Link to="/spot">{quote.productId}</Link>
                  </td>
                  <td>{formatPrice(quote.open)}</td>
                  <td>{formatPrice(quote.high)}</td>
                  <td>{formatPrice(quote.low)}</td>
                  <td>{formatPrice(quote.close)}</td>
                  <td className={quote.changePct == null ? undefined : up ? "bid" : "ask"}>
                    {formatChange(quote.changePct)}
                  </td>
                  <td>{formatVolume(quote.volume)}</td>
                  <td>{formatVolume(quote.volume24h)}</td>
                  <td>{formatVolume(quote.avgVolume)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
