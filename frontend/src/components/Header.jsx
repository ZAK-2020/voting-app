import React from "react";
import { Link, useNavigate } from "react-router-dom";

const Header = ({ user, logout, showNotification }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    showNotification("Logout successfully", "success");
    navigate("/");
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <Link to="/" className="logo-mark">
          <span className="logo-orb" />
          <span className="logo-copy">
            <span className="logo-eyebrow">Live polls</span>
            <span className="logo-title">Real-Time Voting System</span>
          </span>
        </Link>
      </div>

      <div className="auth-info">
        {user?._id ? (
          <>
            <div className="user-chip">
              <span className="user-chip-label">
                {user?.role === "admin" ? "Admin session" : "Signed in"}
              </span>
              <span className="user-chip-value">
                {user?.username || user?.email || "User"}
              </span>
            </div>
            {user?.role === "admin" && (
              <Link to="/admin" className="auth-link auth-link-secondary">
                Manage options
              </Link>
            )}
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="auth-link auth-link-secondary">
              Login
            </Link>
            <Link to="/register" className="auth-link">
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
