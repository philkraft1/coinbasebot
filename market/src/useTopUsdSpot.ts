import { useEffect, useState } from "react";
import {
  FALLBACK_TOP_USD,
  REFRESH_MS,
  fetchTopUsdSpot,
  productsEqual,
} from "./topProducts";

export function useTopUsdSpot(refreshMs = REFRESH_MS) {
  const [products, setProducts] = useState<string[]>([...FALLBACK_TOP_USD]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchTopUsdSpot();
        if (cancelled) return;
        setProducts((prev) => (productsEqual(prev, next) ? prev : next));
      } catch {
        // Keep the current list (fallback on first load).
      }
    };

    load();
    const timer = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshMs]);

  return products;
}
