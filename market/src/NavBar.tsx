import { NavLink } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { WalletButton } from "./WalletButton";

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <strong>Coinbasebot</strong>
        <span className="muted">Live charts</span>
      </div>
      <div className="nav-links">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/spot">Spot</NavLink>
        <WalletButton />
        {user ? (
          <span className="nav-user">
            <span className="muted">{user.username}</span>
            <button type="button" className="text-btn" onClick={() => void logout()}>
              Log out
            </button>
          </span>
        ) : (
          <NavLink to="/login">Login / Signup</NavLink>
        )}
      </div>
    </nav>
  );
}
