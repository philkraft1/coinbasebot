import { Link } from "react-router-dom";
import { layoutCandleChart } from "../chart.ts";
import { landingExamples } from "../landingExamples.ts";
import { formatChange, formatPrice, formatVolume } from "../landingQuotes.ts";
import { sma } from "../studies.ts";
import { useLandingQuotes } from "../useLandingQuotes.ts";

function MiniSpot({ bars }: { bars: ReturnType<typeof landingExamples>[number]["bars"] }) {
  const closes = bars.map((bar) => bar.close);
  const layout = layoutCandleChart(bars, 420, 150, 300, {
    overlays: [{ id: "sma20", className: "sma20", values: sma(closes, 8) }],
    volSma: null,
    rsi: null,
    macd: null,
  });

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
  const rows = landingExamples();
  const { quotes, status } = useLandingQuotes();

  return (
    <section className="showcase">
      <div className="showcase-split">
        <table className="showcase-table">
          <caption>Spot charts</caption>
          <thead>
            <tr>
              <th>5m candles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId}>
                <td>
                  <Link className="preview-card" to="/spot">
                    <div className="preview-head">
                      <strong>{row.productId}</strong>
                      <span className="muted">
                        {row.interval} · {row.name}
                      </span>
                    </div>
                    <MiniSpot bars={row.bars} />
                  </Link>
                </td>
              </tr>
            ))}
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
