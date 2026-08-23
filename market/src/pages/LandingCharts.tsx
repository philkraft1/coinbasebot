import { Link } from "react-router-dom";
import { layoutCandleChart } from "../chart.ts";
import { landingExamples } from "../landingExamples.ts";
import { sma } from "../studies.ts";

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

function MiniPrice({ bars }: { bars: ReturnType<typeof landingExamples>[number]["bars"] }) {
  const width = 420;
  const height = 150;
  const pad = { l: 8, r: 8, t: 10, b: 10 };
  const closes = bars.map((bar) => bar.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const points = closes
    .map((value, i) => {
      const x = pad.l + (i / Math.max(closes.length - 1, 1)) * innerW;
      const y = pad.t + (1 - (value - min) / range) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = closes[closes.length - 1];
  const up = last >= closes[0];
  const area = `${pad.l},${(height - pad.b).toFixed(2)} ${points} ${(width - pad.r).toFixed(2)},${(height - pad.b).toFixed(2)}`;

  return (
    <svg className="preview-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={area} className={up ? "price-fill up" : "price-fill down"} />
      <polyline points={points} className={up ? "price-line up" : "price-line down"} />
    </svg>
  );
}

function money(value: number) {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

export function LandingCharts() {
  const rows = landingExamples();

  return (
    <section className="showcase">
      <table className="showcase-table">
        <caption>Example spot candles and last-price paths</caption>
        <thead>
          <tr>
            <th>Spot charts</th>
            <th>Pricing charts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const up = row.changePct >= 0;
            return (
              <tr key={row.productId}>
                <td>
                  <Link className="preview-card" to="/spot">
                    <div className="preview-head">
                      <strong>{row.productId}</strong>
                      <span className="muted">
                        {row.interval} candles · {row.name}
                      </span>
                    </div>
                    <MiniSpot bars={row.bars} />
                  </Link>
                </td>
                <td>
                  <Link className="preview-card" to="/spot">
                    <div className="preview-head">
                      <strong>${money(row.last)}</strong>
                      <span className={up ? "bid" : "ask"}>
                        {up ? "+" : ""}
                        {row.changePct.toFixed(2)}%
                      </span>
                    </div>
                    <MiniPrice bars={row.bars} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
