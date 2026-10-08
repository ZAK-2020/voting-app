import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatDate, isClosed } from "../api";
import { PollQR } from "./SharePoll";
import { shareOrigin } from "../sharing";
import HiddenResults from "./HiddenResults";

export default function PresentationPage({ revision, connected }) {
  const { id } = useParams();
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const panel = useRef(null);
  useEffect(() => {
    let active = true;
    api("/api/polls/" + id + "?view=presentation")
      .then((data) => {
        if (active) {
          setPoll(data);
          setError("");
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id, revision, retry]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", change);
    };
  }, []);
  async function toggleFullscreen() {
    setNotice("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (panel.current?.requestFullscreen)
        await panel.current.requestFullscreen();
      else
        setNotice(
          "Fullscreen is not supported here. You can still present in this window.",
        );
    } catch {
      setNotice(
        "Fullscreen could not open. You can still present in this window.",
      );
    }
  }
  if (!poll)
    return (
      <div className="page-message">
        <Link to={"/polls/" + id}>← Back to poll</Link>
        <p role={error ? "alert" : "status"}>
          {error || "Getting your presentation ready…"}
        </p>
        {error && (
          <button
            className="button secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        )}
      </div>
    );
  const closed = isClosed(poll, now);
  const full = poll.totalVotes >= 10000;
  const highest = Math.max(...poll.options.map((option) => option.votes));
  const leaders = poll.options.filter((option) => option.votes === highest);
  return (
    <div className="presentation" ref={panel}>
      <header className="presentation-toolbar">
        <Link className="back-link" to={"/polls/" + id}>
          ← Back to poll
        </Link>
        <span className="live-label">
          <span
            className={
              "status-dot " + (!connected || closed || error ? "offline" : "")
            }
          />
          {error
            ? "Results unavailable"
            : !connected
              ? "Reconnecting…"
              : closed
                ? "Poll closed"
                : "Live results"}
        </span>
        <button className="button secondary small" onClick={toggleFullscreen}>
          {fullscreen ? "Exit fullscreen" : "Fullscreen ⛶"}
        </button>
      </header>
      {notice && (
        <p className="form-note" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          Results may be out of date. {error}
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <div className="presentation-grid">
        <section
          className="presentation-results"
          aria-label="Live poll results"
        >
          <span className="eyebrow">Gather · Decide together</span>
          <h1>{poll.question}</h1>
          <p className="presentation-meta">
            {poll.totalVotes} {poll.totalVotes === 1 ? "response" : "responses"}{" "}
            ·{" "}
            {closed
              ? "Voting has ended"
              : full
                ? "Response limit reached"
                : poll.closesAt
                  ? "Closes " + formatDate(poll.closesAt)
                  : "Voting is open"}
          </p>
          {poll.resultsVisible !== true ? <HiddenResults poll={poll} presentation /> : <><div className="presentation-bars">
            {poll.options.map((option) => {
              const percent = poll.totalVotes
                ? Math.round((option.votes / poll.totalVotes) * 100)
                : 0;
              return (
                <div
                  className={
                    "result-row " +
                    (option.votes === highest && highest > 0
                      ? "your-result"
                      : "")
                  }
                  key={option._id}
                >
                  <div className="result-label">
                    <span>{option.label}</span>
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
          </div>
          <p className="presentation-summary">
            {!poll.totalVotes ? (
              closed ? (
                "No votes were recorded."
              ) : (
                "The first vote gets things started."
              )
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
          </p></>}
        </section>
        <aside className="presentation-invite">
          <span className="eyebrow">
            {closed || full ? "Explore the results" : "Your voice belongs here"}
          </span>
          <h2>{closed || full ? "Scan to view" : "Scan to vote"}</h2>
          <PollQR poll={poll} size={256} />
          {poll.joinCode && (
            <>
              <p>
                Or open{" "}
                <strong className="join-address">
                  {new URL(shareOrigin()).host}/join
                </strong>{" "}
                and enter
              </p>
              <strong
                className="join-code-display"
                aria-label={"Join code " + poll.joinCode.split("").join(" ")}
              >
                {poll.joinCode}
              </strong>
            </>
          )}
          <span className="field-hint">
            {closed || full
              ? "Voting has ended. Results stay available."
              : "Sign in. Choose one. Have your say."}
          </span>
        </aside>
      </div>
    </div>
  );
}
