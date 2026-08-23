import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./AuthContext";
import { BaseAppMeta } from "./BaseAppMeta";
import { NavBar } from "./NavBar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import "./index.css";

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
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
