import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export function Home() {
  const { user } = useAuth();

  return (
    <main className="page home">
      <p className="eyebrow">Coinbase Advanced Trade</p>
      <h1>Live top-10 USD spot charts</h1>
      <p className="lede">
        Watch the market, keep your studies, and customize the terminal. Public Coinbase data streams
        without an API key. Sign in to save intervals, ranges, and indicators to your account.
      </p>
      <div className="cta-row">
        <Link className="btn primary" to="/spot">
          Open spot
        </Link>
        {user ? (
          <p className="muted">Signed in as {user.username}. Your studies save automatically.</p>
        ) : (
          <Link className="btn" to="/login">
            Login / Signup
          </Link>
        )}
      </div>
    </main>
  );
}
