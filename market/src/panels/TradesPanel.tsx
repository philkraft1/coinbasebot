import type { Trade } from "../parse";

export function TradesPanel({ productId, trades }: { productId: string; trades: Trade[] }) {
  const rows = trades.filter((trade) => trade.product_id === productId).slice(0, 16);
  return (
    <section className="panel trades">
      <h2>Tape · {productId}</h2>
      {rows.length === 0 ? (
        <p className="empty">No trades yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Side</th>
              <th>Size</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((trade, index) => (
              <tr key={`${trade.trade_id ?? trade.time ?? index}`}>
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
