/** Public-channel exceptions among `-USDC` pairs (same rule as the CLI feed). */
export const USDC_ALLOWED_PUBLIC = new Set(["USDT-USDC", "EURC-USDC"]);
export const PRODUCT_ID_RE = /^[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/;

export const FALLBACK_TOP_USD = [
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
  "XRP-USD",
  "DOGE-USD",
  "ADA-USD",
  "AVAX-USD",
  "LINK-USD",
  "LTC-USD",
  "SHIB-USD",
] as const;

/** Same-origin Vite proxy — Coinbase's public products API has no browser CORS allowlist. */
export const PRODUCTS_URL = "/coinbase-api/api/v3/brokerage/market/products";
export const REFRESH_MS = 5 * 60 * 1000;

export type CatalogProduct = {
  product_id?: string;
  quote_currency_id?: string;
  product_type?: string;
  trading_disabled?: boolean;
  is_disabled?: boolean;
  status?: string;
  volume_24h?: string;
  approximate_quote_24h_volume?: string;
};

export function quoteVolume(product: CatalogProduct): number {
  const n = Number(product.approximate_quote_24h_volume || product.volume_24h || 0);
  return Number.isFinite(n) ? n : 0;
}

export function isPublicUsdSpot(product: CatalogProduct): boolean {
  const id = (product.product_id || "").toUpperCase();
  if (!PRODUCT_ID_RE.test(id)) return false;
  if (product.trading_disabled || product.is_disabled) return false;
  if (product.product_type && product.product_type.toUpperCase() !== "SPOT") return false;
  if (id.endsWith("-USDC")) return USDC_ALLOWED_PUBLIC.has(id);
  return product.quote_currency_id === "USD" || id.endsWith("-USD");
}

export function rankTopUsdSpot(products: CatalogProduct[], limit = 10): string[] {
  const seen = new Set<string>();
  const ranked: string[] = [];
  const sorted = [...products].filter(isPublicUsdSpot).sort((a, b) => quoteVolume(b) - quoteVolume(a));
  for (const product of sorted) {
    const id = (product.product_id as string).toUpperCase();
    if (seen.has(id)) continue;
    seen.add(id);
    ranked.push(id);
    if (ranked.length >= limit) break;
  }
  return ranked;
}

export function fillTopUsdSpot(ranked: string[], limit = 10): string[] {
  if (ranked.length >= limit) return ranked.slice(0, limit);
  const fill = FALLBACK_TOP_USD.filter((id) => !ranked.includes(id));
  return [...ranked, ...fill].slice(0, limit);
}

export function productsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

export function coinbaseSpotUrl(productId: string): string {
  return `https://www.coinbase.com/advanced-trade/spot/${encodeURIComponent(productId)}`;
}

type ProductsPage = {
  products?: CatalogProduct[];
  pagination?: { has_next?: boolean; next_cursor?: string };
};

export async function fetchTopUsdSpot(limit = 10, fetcher: typeof fetch = fetch): Promise<string[]> {
  const products: CatalogProduct[] = [];
  let cursor = "";
  for (let page = 0; page < 8; page += 1) {
    const url = new URL(PRODUCTS_URL);
    url.searchParams.set("product_type", "SPOT");
    url.searchParams.set("limit", "250");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`Coinbase products HTTP ${response.status}`);
    const data = (await response.json()) as ProductsPage;
    products.push(...(data.products || []));
    if (!data.pagination?.has_next || !data.pagination.next_cursor) break;
    cursor = data.pagination.next_cursor;
  }
  return fillTopUsdSpot(rankTopUsdSpot(products, limit), limit);
}
