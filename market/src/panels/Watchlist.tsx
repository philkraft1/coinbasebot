import { coinbaseSpotUrl } from "../topProducts";
import type { ProductStatus, Ticker } from "../parse";

export function Watchlist({
  products,
  focused,
  tickers,
  statuses,
  onFocus,
}: {
  products: string[];
  focused: string;
  tickers: Record<string, Ticker>;
  statuses: Record<string, ProductStatus>;
  onFocus: (productId: string) => void;
}) {
  return (
    <section className="panel watchlist">
      <h2>Top 10</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Last</th>
            <th>24h</th>
            <th>Bid</th>
            <th>Ask</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((id) => {
            const ticker = tickers[id];
            const status = statuses[id];
            const change = Number(ticker?.price_percent_chg_24_h);
            const changeClass = Number.isFinite(change) ? (change >= 0 ? "bid" : "ask") : "";
            return (
              <tr
                key={id}
                className={id === focused ? "selected" : undefined}
                onClick={() => onFocus(id)}
              >
                <td>
                  <span
                    className={`pip ${status?.trading_disabled ? "err" : status?.status === "online" ? "live" : "wait"}`}
                  />
                  {id}
                </td>
                <td>{ticker?.price ?? "—"}</td>
                <td className={changeClass}>
                  {ticker?.price_percent_chg_24_h ? `${Number(ticker.price_percent_chg_24_h).toFixed(2)}%` : "—"}
                </td>
                <td className="bid">{ticker?.best_bid ?? "—"}</td>
                <td className="ask">{ticker?.best_ask ?? "—"}</td>
                <td>
                  <a
                    href={coinbaseSpotUrl(id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Coinbase
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
