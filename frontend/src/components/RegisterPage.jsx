import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildApiUrl } from "../config";

const RegisterPage = ({ login, showNotification }) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
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
      const response = await fetch(buildApiUrl("/api/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Registration failed");

      const { token, user } = await response.json();

      login(token, user);
      showNotification("Registration Successful", "success");
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
        <span className="section-kicker">Get started</span>
        <h2>Create an account and join the live ballot.</h2>
        <p>
          Register once to vote, track the winning option, and return later
          without losing your session.
        </p>
        <div className="auth-feature-list">
          <span>Fast signup flow</span>
          <span>Real-time results</span>
          <span>Clear one-vote-per-user rules</span>
        </div>
      </div>

      <div className="login-container register-container">
        <h2>Register</h2>
        <p className="auth-subtitle">
          Set up your account to take part in the poll.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a display name"
              required
            />
          </div>

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
              placeholder="Create a secure password"
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
