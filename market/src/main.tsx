import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { App } from "./App";
import { AuthProvider } from "./AuthContext";
import { BaseAppMeta } from "./BaseAppMeta";
import { NavBar } from "./NavBar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { wagmiConfig } from "./wagmi";
import "./index.css";

const queryClient = new QueryClient();

function Shell() {
  const spot = useLocation().pathname === "/spot";
  return (
    <div className={spot ? "app-shell mode-spot" : "app-shell mode-page"}>
      <BaseAppMeta />
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/spot" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
