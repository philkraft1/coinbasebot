import { topLevels } from "../level2";

export function BookPanel({
  productId,
  bids,
  asks,
  stale,
}: {
  productId: string;
  bids: ReturnType<typeof topLevels>;
  asks: ReturnType<typeof topLevels>;
  stale: boolean;
}) {
  const bestBid = bids[0] ? Number(bids[0].price) : null;
  const bestAsk = asks[0] ? Number(asks[0].price) : null;
  const spread = bestBid !== null && bestAsk !== null ? (bestAsk - bestBid).toFixed(2) : "—";

  return (
    <section className="panel book">
      <h2>
        {productId} <span className="spread">spread {spread}</span>
        {stale && <span className="warn"> stale</span>}
      </h2>
      {bids.length === 0 && asks.length === 0 ? (
        <p className="empty">
          {stale ? "Sequence gap — waiting for a fresh book…" : "Waiting for the first level2 snapshot…"}
        </p>
      ) : (
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
      )}
    </section>
  );
}
