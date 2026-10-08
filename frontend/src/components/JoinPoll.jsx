import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { normalizeCode, validCode } from "../sharing";

export function JoinForm({ initialCode = "" }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function join(event) {
    event.preventDefault();
    if (busy) return;
    const normalized = normalizeCode(code);
    if (!validCode(normalized)) {
      setError("Enter the six-character code shown by the organizer.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/join/" + normalized);
      navigate("/polls/" + data.pollId);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="join-form" onSubmit={join}>
      <label htmlFor="join-code">Have a poll code?</label>
      <div className="join-input-row">
        <input
          id="join-code"
          aria-describedby={error ? "join-error" : "join-hint"}
          aria-invalid={!!error}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          placeholder="ABC234"
          value={code}
          disabled={busy}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setError("");
          }}
        />
        <button className="button primary" disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Join poll →"}
        </button>
      </div>
      <span className="field-hint" id="join-hint">
        Enter the six-character code to open your poll.
      </span>
      {error && (
        <p className="error-message" id="join-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export default function JoinPoll() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!code) return;
    let active = true;
    setError("");
    const normalized = normalizeCode(code);
    if (!validCode(normalized)) {
      setError("This poll code is not valid.");
      return;
    }
    api("/api/join/" + normalized)
      .then((data) => {
        if (active) navigate("/polls/" + data.pollId, { replace: true });
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [code, navigate]);
  return (
    <div className="auth-page">
      <Link to="/" className="back-link">
        ← All polls
      </Link>
      <section className="surface join-page">
        <span className="eyebrow">You're invited</span>
        <h1>Have your say.</h1>
        {code && !error ? (
          <p className="page-message" role="status">
            Opening your poll…
          </p>
        ) : (
          <>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <JoinForm key={code} initialCode={code || ""} />
          </>
        )}
      </section>
    </div>
  );
}
