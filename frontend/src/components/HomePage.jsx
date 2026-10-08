import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { api, isClosed, formatDate } from "../api";
import { JoinForm } from "./JoinPoll";

export default function HomePage({ revision }) {
  const { user } = useContext(AuthContext);
  const [polls, setPolls] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const archive = filter === "archive";
  useEffect(() => {
    let active = true;
    api(archive ? "/api/polls?archived=true" : "/api/polls")
      .then((data) => {
        if (active) {
          setPolls(data);
          setError("");
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [revision, retry, user?._id, archive]);
  const shown = (polls || []).filter((poll) => {
    const matches =
      filter === "all" || filter === "archive" ||
      (filter === "mine"
        ? poll.createdBy === user?._id
        : filter === "closed"
          ? isClosed(poll)
          : !isClosed(poll));
    return (
      matches && poll.question.toLowerCase().includes(search.toLowerCase())
    );
  });
  const openCount = (polls || []).filter((poll) => !isClosed(poll)).length;
  return (
    <div className="dashboard">
      <section className="page-heading">
        <div>
          <span className="eyebrow">A little input goes a long way</span>
          <h1>Decide together.</h1>
          <p>
            Create a question, invite your people, and see where everyone
            stands.
          </p>
        </div>
        <Link className="button primary" to="/create">
          Create your poll <span aria-hidden="true">↗</span>
        </Link>
      </section>
      <div className="dashboard-summary">
        <span className="status-dot" /> <strong>{archive ? (polls || []).length : openCount}</strong> {archive ? "archived polls" : "open polls"}
        <span className="summary-divider" />
        <span>One voice. One vote per poll.</span>
      </div>
      <section className="join-strip" aria-label="Join a poll">
        <div>
          <h2>Already invited?</h2>
          <p>Go straight to your group's question.</p>
        </div>
        <JoinForm />
      </section>
      <section aria-label="Browse polls">
        <div className="toolbar">
          <div className="filters" aria-label="Filter polls">
            {[
              ["all", "All polls"],
              ["open", "Open"],
              ["closed", "Closed"],
              ["archive", "Archive"],
              ...(user ? [["mine", "My polls"]] : []),
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "filter active" : "filter"}
                onClick={() => { if ((value === "archive") !== archive) { setPolls(null); setError(""); } setFilter(value); }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search">
            <span className="sr-only">Search questions</span>
            <input
              type="search"
              placeholder="Search questions…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {error && (
          <div className="error-message" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {!polls && !error ? (
          <div className="page-message" role="status">
            Loading polls…
          </div>
        ) : polls && shown.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              ✳
            </span>
            <h2>
              {archive ? "No archived polls found." : polls.length
                ? "No polls match just yet."
                : "Your next decision starts here."}
            </h2>
            <p>
              {archive ? "Closed polls moved to the archive will appear here. Try clearing your search." : polls.length
                ? "Try another filter or a different search."
                : "Choosing a meeting time or your next team activity? Give everyone a say."}
            </p>
            {!archive && !polls.length && (
              <Link className="button primary" to="/create">
                Create the first poll
              </Link>
            )}
          </div>
        ) : (
          <div className="poll-grid">
            {shown.map((poll) => {
              const closed = isClosed(poll);
              return (
                <Link
                  className="poll-card"
                  key={poll._id}
                  to={"/polls/" + poll._id}
                >
                  <div className="card-top">
                    <span className={"badge " + (closed ? "closed" : "open")}>
                      <span className="status-dot" />
                      {poll.archivedAt ? "Archived" : closed ? "Closed" : "Open"}
                    </span>
                    <span className="muted">{poll.options.length} options</span>
                  </div>
                  <h2>{poll.question}</h2>
                  <p className="organizer">
                    By {poll.organizer}
                    {poll.createdBy === user?._id ? " · You" : ""}
                  </p>
                  <div className="card-bottom">
                    <div>
                      <strong>{poll.totalVotes}</strong>{" "}
                      {poll.totalVotes === 1 ? "response" : "responses"}
                      <span className="deadline">
                        {closed
                          ? "Voting has ended"
                          : poll.closesAt
                            ? "Closes " + formatDate(poll.closesAt)
                            : "No closing date"}
                      </span>
                    </div>
                    <span className="card-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
