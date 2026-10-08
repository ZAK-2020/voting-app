import { useContext, useEffect, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { api, downloadResults, isClosed, formatDate } from "../api";
import SharePoll from "./SharePoll";
import HiddenResults from "./HiddenResults";

export default function PollPage({ revision, connected }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [poll, setPoll] = useState(null);
  const [receipt, setReceipt] = useState({ userId: null, optionId: null });
  const [ballotReady, setBallotReady] = useState(false);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [managementMessage, setManagementMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [share, setShare] = useState(!!location.state?.created);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    api("/api/polls/" + id)
      .then((data) => {
        if (active) {
          setPoll(data);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id, revision, retry]);
  useEffect(() => {
    let active = true;
    setBallotReady(false);
    if (!user) {
      setReceipt({ userId: null, optionId: null });
      return;
    }
    api("/api/polls/" + id + "/ballot")
      .then((data) => {
        if (active) {
          setReceipt({ userId: user._id, optionId: data.optionId });
          setBallotReady(true);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id, user, revision, retry]);
  const votedFor = receipt.userId === user?._id ? receipt.optionId : null;
  async function vote(event) {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/polls/" + id + "/votes", {
        method: "POST",
        body: { optionId: selected },
      });
      setPoll(data.poll);
      setReceipt({ userId: user._id, optionId: data.optionId });
    } catch (error) {
      setError(error.message);
      setRetry((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    if (busy) return;
    setBusy(true); setError(""); setManagementMessage("");
    try { await downloadResults(id); setManagementMessage("CSV download started."); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  async function moveToArchive(restore = false) {
    if (busy) return;
    setBusy(true); setError(""); setManagementMessage("");
    try {
      setPoll(await api("/api/polls/" + id + (restore ? "/restore" : "/archive"), { method: "POST" }));
      setManagementMessage(restore ? "Poll restored to the dashboard. Voting remains closed." : "Poll archived. Its link and results are still available.");
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  async function duplicate() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const data = await api("/api/polls/" + id + "/duplicate", { method: "POST" });
      navigate("/drafts/" + data.draftId + "/edit");
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  async function close() {
    setBusy(true);
    setError("");
    try {
      setPoll(await api("/api/polls/" + id + "/close", { method: "POST" }));
      setConfirmClose(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (!poll)
    return (
      <div className="narrow-page">
        <Link to="/" className="back-link">
          ← All polls
        </Link>
        <div className="page-message" role={loadError ? "alert" : "status"}>
          {loadError || "Loading poll…"}
          {loadError && (
            <button
              className="button secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  const closed = isClosed(poll, now);
  const full = poll.totalVotes >= 10000;
  const canSeeResults = poll.resultsVisible === true;
  const results = canSeeResults && (showResults || !!votedFor || closed || full);
  const maximum = Math.max(...poll.options.map((option) => option.votes));
  const leaders = poll.options.filter((option) => option.votes === maximum);
  const chosen = poll.options.find((option) => option._id === votedFor);
  return (
    <div className="narrow-page">
      <div className="detail-top">
        <Link to="/" className="back-link">
          ← All polls
        </Link>
        <div className="detail-actions">
          <Link
            className="button secondary small"
            to={"/polls/" + id + "/present"}
          >
            Present ↗
          </Link>
          <button
            className="button secondary small"
            aria-expanded={share}
            onClick={() => setShare((value) => !value)}
          >
            Share poll ↗
          </button>
        </div>
      </div>
      {share && <SharePoll poll={poll} />}
      <article className="surface ballot">
        <div className="card-top">
          <span className={"badge " + (closed ? "closed" : "open")}>
            <span className="status-dot" />
            {closed ? "Closed" : "Open"}
          </span>
          <span className="muted">
            {poll.totalVotes} {poll.totalVotes === 1 ? "response" : "responses"}
          </span>
        </div>
        <h1>{poll.question}</h1>
        <p className="poll-meta">
          By {poll.organizer} ·{" "}
          {closed
            ? "Voting has ended"
            : poll.closesAt
              ? "Closes " + formatDate(poll.closesAt)
              : "No closing date"}
        </p>
        {chosen && (
          <div className="success-message" role="status">
            <strong>✓ Your vote is recorded.</strong>
            <span>You chose {chosen.label}.</span>
          </div>
        )}
        {loadError && (
          <div className="error-message" role="alert">
            Results could not refresh. {loadError}
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!canSeeResults && <HiddenResults poll={poll} />}
        {results ? (
          <section className="results" aria-label="Poll results">
            <div className="results-heading">
              <h2>{closed ? "Final results" : "Results so far"}</h2>
              <span className="live-label">
                <span
                  className={
                    "status-dot " + (!connected || closed ? "offline" : "")
                  }
                />
                {closed ? "Complete" : connected ? "Live" : "Reconnecting…"}
              </span>
            </div>
            <p className="result-summary">
              {!poll.totalVotes ? (
                "No votes yet."
              ) : leaders.length > 1 ? (
                closed ? (
                  "The poll ended in a tie."
                ) : (
                  "It's a tie so far."
                )
              ) : (
                <>
                  <strong>{leaders[0].label}</strong>
                  {closed ? " received the most votes." : " is leading so far."}
                </>
              )}
            </p>
            {poll.options.map((option) => {
              const percent = poll.totalVotes
                ? Math.round((option.votes / poll.totalVotes) * 100)
                : 0;
              return (
                <div
                  className={
                    "result-row " +
                    (option._id === votedFor ? "your-result" : "")
                  }
                  key={option._id}
                >
                  <div className="result-label">
                    <span>
                      {option.label}
                      {option._id === votedFor && <small>Your vote</small>}
                    </span>
                    <strong>
                      {percent}% <span className="muted">({option.votes})</span>
                    </strong>
                  </div>
                  <div
                    className="result-track"
                    role="img"
                    aria-label={
                      option.label +
                      ": " +
                      option.votes +
                      " votes, " +
                      percent +
                      " percent"
                    }
                  >
                    <div style={{ width: percent + "%" }} />
                  </div>
                </div>
              );
            })}
            {!closed && !full && !votedFor && (
              <button
                className="button secondary full-width"
                onClick={() => setShowResults(false)}
              >
                Back to voting
              </button>
            )}
            {full && !closed && (
              <p className="field-hint">
                This poll has reached its 10,000-response limit.
              </p>
            )}
          </section>
        ) : !votedFor && !closed && !full ? (
          <form onSubmit={vote}>
            <fieldset
              className="choices"
              disabled={busy || !user || !ballotReady}
            >
              <legend>Choose one option</legend>
              {poll.options.map((option) => (
                <label
                  key={option._id}
                  className={
                    "choice " + (selected === option._id ? "selected" : "")
                  }
                >
                  <input
                    type="radio"
                    name="option"
                    value={option._id}
                    checked={selected === option._id}
                    onChange={() => setSelected(option._id)}
                    required
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {user ? (
              <>
                <button
                  className="button primary full-width"
                  disabled={!selected || busy || !ballotReady}
                >
                  {busy
                    ? "Submitting…"
                    : !ballotReady
                      ? "Checking your vote…"
                      : "Submit vote"}
                </button>
                <p className="ballot-hint">
                  One vote per poll. Your choice cannot be changed.
                </p>
              </>
            ) : (
              <Link
                className="button primary full-width"
                to="/login"
                state={{ from: "/polls/" + id }}
              >
                Sign in to vote
              </Link>
            )}
            {canSeeResults && <button
              className="text-button view-results"
              type="button"
              onClick={() => setShowResults(true)}
            >
              View current results
            </button>}
          </form>
        ) : null}
      </article>
      {poll.archivedAt && <p className="form-note">Archived on {formatDate(poll.archivedAt)}. Voting is closed; results and sharing links remain available.</p>}
      {managementMessage && <p className="success-message" role="status">{managementMessage}</p>}
      {user?._id === poll.createdBy && <section className="owner-controls" aria-label="Manage results"><div><strong>Keep a copy of your results</strong><p>{canSeeResults ? "Download option totals and percentages as a CSV file." : "Export becomes available when results are visible to you."}</p></div><button className="button secondary small" disabled={busy || !canSeeResults} onClick={exportCsv}>Export CSV</button></section>}
      {user?._id === poll.createdBy && closed && <section className="owner-controls" aria-label="Archive controls"><div><strong>{poll.archivedAt ? "Bring this poll back" : "Finished with this poll?"}</strong><p>{poll.archivedAt ? "Restore it to the dashboard. Voting stays closed." : "Move it to Archive to keep the dashboard focused. The poll link will still work."}</p></div><button className="button secondary small" disabled={busy} onClick={() => moveToArchive(!!poll.archivedAt)}>{poll.archivedAt ? "Restore poll" : "Archive poll"}</button></section>}
      {user?._id === poll.createdBy && <div className="owner-controls"><div><strong>Run this poll again</strong><p>Copy the question, options, and results setting to a private draft. Votes and the closing date start fresh.</p></div><button className="button secondary small" disabled={busy} onClick={duplicate}>{busy ? "Please wait…" : "Duplicate poll"}</button></div>}
      {user?._id === poll.createdBy && !closed && (
        <div className="owner-controls">
          {confirmClose ? (
            <>
              <p>
                <strong>Close voting now?</strong> This cannot be undone.
                Results will remain available.
              </p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirmClose(false)}
                >
                  Keep open
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={close}
                >
                  {busy ? "Closing…" : "Close poll"}
                </button>
              </div>
            </>
          ) : (
            <>
              <span>You organize this poll.</span>
              <button
                className="text-button"
                onClick={() => setConfirmClose(true)}
              >
                Close voting
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
