import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildApiUrl } from "../config";

const LoginPage = ({ login, showNotification }) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(buildApiUrl("/api/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Login failed");

      const { token, user } = await response.json();

      login(token, user);
      showNotification("Login Successful", "success");
      navigate("/");
    } catch (error) {
      showNotification(error?.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <span className="section-kicker">Welcome back</span>
        <h2>Sign in to cast your vote.</h2>
        <p>
          Jump straight into the live ballot, watch the count update in real
          time, and keep your session active across refreshes.
        </p>
        <div className="auth-feature-list">
          <span>Live vote updates</span>
          <span>One-click participation</span>
          <span>Admin controls for organizers</span>
        </div>
      </div>

      <div className="login-container">
        <h2>Login</h2>
        <p className="auth-subtitle">
          Use your registered email and password to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
