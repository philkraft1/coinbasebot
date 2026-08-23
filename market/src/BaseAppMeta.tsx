import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ensureBaseAppIdMeta } from "./baseAppMeta.ts";

export function BaseAppMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    ensureBaseAppIdMeta();
  }, [pathname]);
  return null;
}
