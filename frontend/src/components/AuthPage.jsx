import { useContext, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { api } from "../api";

export default function AuthPage({ register = false }) {
  const { user, login } = useContext(AuthContext);
  const location = useLocation();
  const target = location.state?.from;
  const destination =
    typeof target === "string" &&
    (target === "/create" || target === "/drafts" || /^\/drafts\/[a-f0-9]{24}\/edit$/.test(target) || /^\/polls\/[a-f0-9]{24}$/.test(target))
      ? target
      : "/";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={destination} replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = await api(register ? "/api/register" : "/api/login", {
        method: "POST",
        body: fields,
      });
      login(data.token, data.user);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Link className="back-link" to="/">
        ← All polls
      </Link>
      <div className="surface auth-card">
        <span className="eyebrow">
          {register ? "A seat at the table" : "Welcome back"}
        </span>
        <h1>{register ? "Join the conversation." : "Your voice matters."}</h1>
        <p className="muted">
          {register
            ? "Create an account to start polls and cast your vote."
            : destination === "/create"
              ? "Sign in to create your poll."
              : destination.startsWith("/polls/")
                ? "Sign in and we’ll take you back to your poll."
                : "Sign in to create a poll or have your say."}
        </p>
        <form onSubmit={submit} key={register ? "register" : "login"}>
          <fieldset disabled={busy}>
            {register && (
              <div className="form-group">
                <label htmlFor="username">Display name</label>
                <input
                  id="username"
                  name="username"
                  autoComplete="nickname"
                  required
                  maxLength={60}
                  placeholder="What should we call you?"
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 8 : undefined}
                placeholder={
                  register ? "At least 8 characters" : "Enter your password"
                }
              />
            </div>
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            </button>
          </fieldset>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account? " : "New here? "}
          <Link
            to={register ? "/login" : "/register"}
            state={{ from: destination }}
            onClick={() => setError("")}
          >
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
