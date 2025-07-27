import React, { useEffect } from "react";

const HomePage = ({
  votes = [],
  error,
  user,
  setUser,
  setVotes,
  showNotification,
}) => {  
  const handleVote = async (voteId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API}/api/vote/${voteId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();

      setVotes((prev) =>
        prev.map((v) => (v?._d === data?.vote?._id ? data?.vote : v))
      );

      setUser(data?.user);
    } catch (error) {
      showNotification(error?.message || "Something went wrong", "error");
    }
  };

  useEffect(() => {
    console.log("Current Votes:", votes);
  }, [votes]);

  return (
    <div className="votes-page">
      {error && <div className="error-message">{error}</div>}
      <div className="votes-grid">
        {Array.isArray(votes) &&
          votes.map((vote, index) => (
            <div className="vote-card" key={index}>
              <h2>{vote.option}</h2>
              <p className="vote-count">Votes: {vote.votes}</p>
              <p className="createdBy">Created By: {vote.createdBy?.email}</p>
              <button
                className={`vote-btn ${!user || user?.votedFor ? "disabled" : ""}`}
                onClick={() => handleVote(vote?._id)}
                disabled={!user || user?.votedFor}
              >
                {vote?._id === user?.votedFor ? "Voted" : "Vote"}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
};

export default HomePage;
