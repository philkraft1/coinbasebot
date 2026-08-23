import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export function Login() {
  const { user, login, signup, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await signup(username, password);
      else await login(username, password);
      navigate("/spot");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <main className="page auth-page">
        <h1>Signed in</h1>
        <p className="lede">
          You are {user.username}. Spot will load your saved studies and last product.
        </p>
        <div className="cta-row">
          <Link className="btn primary" to="/spot">
            Open spot
          </Link>
          <button type="button" className="btn" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page auth-page">
      <h1>{mode === "signup" ? "Create an account" : "Log in"}</h1>
      <p className="lede">
        Username and password only. Studies, time frames, and your last spot product save to the
        credentials database after you sign in.
      </p>
      <div className="mode-toggle">
        <button type="button" className={mode === "login" ? "chip on" : "chip"} onClick={() => setMode("login")}>
          Log in
        </button>
        <button type="button" className={mode === "signup" ? "chip on" : "chip"} onClick={() => setMode("signup")}>
          Sign up
        </button>
      </div>
      <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_]+"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>
    </main>
  );
}
