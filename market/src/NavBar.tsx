import { NavLink } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <img className="nav-logo" src="/ivory-logo.png" width={36} height={36} alt="" />
        <strong>Ivory</strong>
        <span className="muted">Live charts</span>
      </div>
      <div className="nav-links">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/spot">Spot</NavLink>
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
