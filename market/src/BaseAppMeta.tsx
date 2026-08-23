import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { syncBaseAppIdMeta } from "./baseAppMeta.ts";

export function BaseAppMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    syncBaseAppIdMeta(pathname);
  }, [pathname]);
  return null;
}
