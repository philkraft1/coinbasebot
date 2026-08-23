import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { layoutCandleChart } from "../chart";
import { bucketCandles, fetchCandleHistory, mergeFiveMinuteBars, type Candle, type OhlcBar } from "../parse";
import { bollinger, ema, macd, rsi, sma, vwap, type StudyConfig } from "../studies";
import { INTERVALS, RANGES, intervalSeconds, planCandleSource, rangeStartUtc, type IntervalId } from "../timeframes";

function intervalLabel(interval: IntervalId, customMinutes: number) {
  return interval === "custom" ? `${customMinutes}m` : interval;
}

export function CandleChart({ productId, raw }: { productId: string; raw: Record<string, Candle[]> }) {
  const { prefs, setPrefs } = useAuth();
  const { interval, customMinutes, range, studies } = prefs;
  const [openStudies, setOpenStudies] = useState(false);
  const [history, setHistory] = useState<OhlcBar[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const period = intervalSeconds(interval, customMinutes);

  useEffect(() => {
    let cancelled = false;
    const end = Math.floor(Date.now() / 1000);
    const start = rangeStartUtc(range);
    const plan = planCandleSource(period, end - start);
    setHint(plan.hint);
    fetchCandleHistory({ productId, granularity: plan.granularity, start, end })
      .then((bars) => {
        if (cancelled) return;
        const bucketed = plan.bucketSeconds === period ? bars : bucketCandles(bars, period);
        setHistory(bucketed);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, period, range]);

  const bars = useMemo(() => {
    const start = rangeStartUtc(range);
    const live = bucketCandles(raw[productId] || [], period);
    return mergeFiveMinuteBars(history, live, 400).filter((bar) => bar.start >= start);
  }, [history, raw, productId, period, range]);

  const closes = useMemo(() => bars.map((bar) => bar.close), [bars]);
  const volumes = useMemo(() => bars.map((bar) => bar.volume), [bars]);

  const studySeries = useMemo(() => {
    const overlays: Array<{ id: string; className: string; values: Array<number | null> }> = [];
    if (studies.sma20) overlays.push({ id: "sma20", className: "sma20", values: sma(closes, 20) });
    if (studies.sma50) overlays.push({ id: "sma50", className: "sma50", values: sma(closes, 50) });
    if (studies.sma200) overlays.push({ id: "sma200", className: "sma200", values: sma(closes, 200) });
    if (studies.ema12) overlays.push({ id: "ema12", className: "ema12", values: ema(closes, 12) });
    if (studies.ema26) overlays.push({ id: "ema26", className: "ema26", values: ema(closes, 26) });
    if (studies.bb) {
      const bands = bollinger(closes, studies.bbPeriod, studies.bbStd);
      overlays.push({ id: "bbMid", className: "bb-mid", values: bands.mid });
      overlays.push({ id: "bbUp", className: "bb-band", values: bands.upper });
      overlays.push({ id: "bbLo", className: "bb-band", values: bands.lower });
    }
    if (studies.vwap) overlays.push({ id: "vwap", className: "vwap", values: vwap(bars) });
    return {
      overlays,
      volSma: studies.volSma ? sma(volumes, studies.volSmaPeriod) : null,
      rsi: studies.rsi ? rsi(closes, studies.rsiPeriod) : null,
      macd: studies.macd ? macd(closes, studies.macdFast, studies.macdSlow, studies.macdSignal) : null,
    };
  }, [bars, closes, volumes, studies]);

  const last = bars.at(-1);
  const up = last ? last.close >= last.open : true;
  const extra = Boolean(studies.rsi || studies.macd);
  const layout = useMemo(
    () => layoutCandleChart(bars, 1000, extra ? 480 : 400, period, studySeries),
    [bars, period, studySeries, extra],
  );

  function patch(partial: Partial<StudyConfig>) {
    setPrefs({ studies: { ...studies, ...partial } });
  }

  return (
    <section className="panel candle-chart">
      <div className="chart-head">
        <h2>
          {intervalLabel(interval, customMinutes)} · {range} · {productId}
        </h2>
        {last && (
          <p className={`candle ${up ? "bid" : "ask"}`}>
            o {last.open.toFixed(2)} · h {last.high.toFixed(2)} · l {last.low.toFixed(2)} · c{" "}
            {last.close.toFixed(2)} · v {last.volume.toFixed(4)}
          </p>
        )}
      </div>
      <div className="chart-toolbar">
        <div className="chips">
          {INTERVALS.map((id) => (
            <button key={id} className={interval === id ? "chip on" : "chip"} onClick={() => setPrefs({ interval: id })}>
              {id}
            </button>
          ))}
          <button className={interval === "custom" ? "chip on" : "chip"} onClick={() => setPrefs({ interval: "custom" })}>
            Custom
          </button>
          {interval === "custom" && (
            <label className="custom-min">
              <input
                type="number"
                min={1}
                max={1440}
                value={customMinutes}
                onChange={(event) => setPrefs({ customMinutes: Number(event.target.value) || 1 })}
              />
              m
            </label>
          )}
        </div>
        <div className="chips">
          {RANGES.map((id) => (
            <button key={id} className={range === id ? "chip on" : "chip"} onClick={() => setPrefs({ range: id })}>
              {id}
            </button>
          ))}
        </div>
        <div className="studies-wrap">
          <button className={openStudies ? "chip on" : "chip"} onClick={() => setOpenStudies((v) => !v)}>
            Studies
          </button>
          {openStudies && (
            <div className="studies-pop">
              <label>
                <input type="checkbox" checked={studies.sma20} onChange={(e) => patch({ sma20: e.target.checked })} />
                SMA 20
              </label>
              <label>
                <input type="checkbox" checked={studies.sma50} onChange={(e) => patch({ sma50: e.target.checked })} />
                SMA 50
              </label>
              <label>
                <input type="checkbox" checked={studies.sma200} onChange={(e) => patch({ sma200: e.target.checked })} />
                SMA 200
              </label>
              <label>
                <input type="checkbox" checked={studies.ema12} onChange={(e) => patch({ ema12: e.target.checked })} />
                EMA 12
              </label>
              <label>
                <input type="checkbox" checked={studies.ema26} onChange={(e) => patch({ ema26: e.target.checked })} />
                EMA 26
              </label>
              <label>
                <input type="checkbox" checked={studies.bb} onChange={(e) => patch({ bb: e.target.checked })} />
                Bollinger
                <input
                  type="number"
                  value={studies.bbPeriod}
                  min={2}
                  onChange={(e) => patch({ bbPeriod: Number(e.target.value) || 20 })}
                />
                <input
                  type="number"
                  step="0.1"
                  value={studies.bbStd}
                  min={0.1}
                  onChange={(e) => patch({ bbStd: Number(e.target.value) || 2 })}
                />
              </label>
              <label>
                <input type="checkbox" checked={studies.vwap} onChange={(e) => patch({ vwap: e.target.checked })} />
                VWAP
              </label>
              <label>
                <input type="checkbox" checked={studies.rsi} onChange={(e) => patch({ rsi: e.target.checked })} />
                RSI
                <input
                  type="number"
                  value={studies.rsiPeriod}
                  min={2}
                  onChange={(e) => patch({ rsiPeriod: Number(e.target.value) || 14 })}
                />
              </label>
              <label>
                <input type="checkbox" checked={studies.macd} onChange={(e) => patch({ macd: e.target.checked })} />
                MACD
                <input
                  type="number"
                  value={studies.macdFast}
                  min={2}
                  onChange={(e) => patch({ macdFast: Number(e.target.value) || 12 })}
                />
                <input
                  type="number"
                  value={studies.macdSlow}
                  min={2}
                  onChange={(e) => patch({ macdSlow: Number(e.target.value) || 26 })}
                />
                <input
                  type="number"
                  value={studies.macdSignal}
                  min={2}
                  onChange={(e) => patch({ macdSignal: Number(e.target.value) || 9 })}
                />
              </label>
              <label>
                <input type="checkbox" checked={studies.volSma} onChange={(e) => patch({ volSma: e.target.checked })} />
                Vol SMA
                <input
                  type="number"
                  value={studies.volSmaPeriod}
                  min={2}
                  onChange={(e) => patch({ volSmaPeriod: Number(e.target.value) || 20 })}
                />
              </label>
            </div>
          )}
        </div>
      </div>
      {hint && <p className="muted hint">{hint}</p>}
      {bars.length === 0 ? (
        <p className="empty">Waiting for candles…</p>
      ) : (
        <svg className="chart" viewBox={`0 0 ${layout.width} ${extra ? 480 : 400}`} preserveAspectRatio="none">
          {layout.priceLabels.map((label) => (
            <g key={`p-${label.text}-${label.y}`}>
              <line x1={layout.padL} x2={layout.width} y1={label.y} y2={label.y} className="grid" />
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
          {layout.overlays.map((line) =>
            line.points ? <polyline key={line.id} points={line.points} className={`overlay ${line.className}`} /> : null,
          )}
          {layout.volSma ? <polyline points={layout.volSma} className="overlay vol-sma" /> : null}
          {layout.rsi && (
            <g>
              {layout.rsi.labels.map((label) => (
                <g key={`rsi-${label.text}`}>
                  <line x1={layout.padL} x2={layout.width} y1={label.y} y2={label.y} className="grid" />
                  <text x={4} y={label.y + 4} className="axis">
                    {label.text}
                  </text>
                </g>
              ))}
              <polyline points={layout.rsi.line} className="overlay rsi" />
            </g>
          )}
          {layout.macd && (
            <g>
              {layout.macd.hist.map((bar, i) => (
                <rect
                  key={`mh-${i}`}
                  x={bar.x}
                  y={bar.y}
                  width={bar.w}
                  height={bar.h}
                  className={bar.up ? "macd-hist up" : "macd-hist down"}
                />
              ))}
              <polyline points={layout.macd.line} className="overlay macd" />
              <polyline points={layout.macd.signal} className="overlay macd-sig" />
            </g>
          )}
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
