import React, { useEffect } from "react";
import { buildApiUrl } from "../config";

const HomePage = ({
  votes = [],
  error,
  user,
  setUser,
  setVotes,
  showNotification,
}) => {
  const totalVotes = votes.reduce((sum, vote) => sum + (vote?.votes || 0), 0);
  const activeOption = votes.find((vote) => vote?._id === user?.votedFor);
  const hasVotes = votes.length > 0;

  const handleVote = async (voteId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/vote/${voteId}`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();

      // update vote list
      setVotes((prev) =>
        prev.map((v) => (v?._id === data?.vote?._id ? data?.vote : v))
      );

      // update user
      setUser(data?.user);
      showNotification("Vote submitted successfully", "success");

    } catch (error) {
      showNotification(error?.message || "Something went wrong", "error");
    }
  };

  useEffect(() => {
  }, [votes]);

  return (
    <div className="votes-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="section-kicker">Community ballot</span>
          <h2>Vote once, see updates instantly, and keep the process simple.</h2>
          <p>
            Track live results, join the poll in seconds, and keep every option
            visible in one clean flow.
          </p>
          <div className="hero-status-row">
            <div className="stat-card">
              <span className="stat-label">Options</span>
              <strong>{votes.length}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total votes</span>
              <strong>{totalVotes}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Your status</span>
              <strong>
                {!user
                  ? "Login required"
                  : user?.votedFor
                    ? "Vote submitted"
                    : "Ready to vote"}
              </strong>
            </div>
          </div>
        </div>

        <div className="hero-sidecard">
          <h3>What to do next</h3>
          {!user ? (
            <p>
              Create an account or sign in to cast your vote. You can still
              browse the live options below before deciding.
            </p>
          ) : activeOption ? (
            <p>
              You voted for <strong>{activeOption.option}</strong>. Results will
              keep updating here in real time.
            </p>
          ) : (
            <p>
              You are signed in and ready. Pick one option below to lock in your
              vote.
            </p>
          )}
        </div>
      </section>

      {error && <div className="error-message">{error}</div>}

      {!user && (
        <div className="inline-banner">
          <span className="inline-banner-title">Guest mode</span>
          <span>
            Results are visible to everyone, but voting is only enabled after
            login.
          </span>
        </div>
      )}

      {user?.votedFor && activeOption && (
        <div className="inline-banner inline-banner-success">
          <span className="inline-banner-title">Vote recorded</span>
          <span>You selected {activeOption.option}. You can follow the live count below.</span>
        </div>
      )}

      {!hasVotes ? (
        <div className="empty-state">
          <h3>No vote options yet</h3>
          <p>
            Once an admin adds options, they will appear here automatically for
            everyone.
          </p>
        </div>
      ) : (
      <div className="votes-grid">
        {Array.isArray(votes) &&
          votes.map((vote, index) => (
            <div className="vote-card" key={index}>
              <div className="vote-card-top">
                <span className="vote-pill">Option {index + 1}</span>
                {vote?._id === user?.votedFor && (
                  <span className="vote-pill vote-pill-selected">Your vote</span>
                )}
              </div>

              <h2>{vote.option}</h2>

              <p className="vote-count">
                Votes: {vote.votes}
              </p>

              <p className="createdBy">
                Created by {vote.createdBy?.email || "Admin"}
              </p>

              <button
                className={`vote-btn ${
                  !user || user?.votedFor ? "disabled" : ""
                }`}
                onClick={() => handleVote(vote?._id)}
                disabled={!user || user?.votedFor}
              >
                {vote?._id === user?.votedFor ? "Voted" : "Vote"}
              </button>
            </div>
          ))}
      </div>
      )}
    </div>
  );
};

export default HomePage;
