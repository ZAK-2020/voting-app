import React, { useState } from "react";
import { buildApiUrl } from "../config";

const AdminPanel = ({ votes, setVotes, showNotification }) => {
  const [newOption, setNewOption] = useState("");
  const totalVotes = votes.reduce((sum, vote) => sum + (vote?.votes || 0), 0);

  const handleAddOption = async () => {
    if (!newOption?.trim()) return;

    try {
      const response = await fetch(buildApiUrl("/api/votes"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ option: newOption }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      setNewOption("");
      showNotification("Option added successfully", "success");

      // WebSocket will update votes automatically
    } catch (error) {
      console.error("Error adding option:", error);
      showNotification("Error adding option", "error");
    }
  };

  const handleDeleteOption = async (id) => {
    try {
      const response = await fetch(buildApiUrl(`/api/vote/${id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      await response.json();

      setVotes((prev) => prev.filter((vote) => vote._id !== id));

      showNotification("Option deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting option:", error);
      showNotification("Error deleting option", "error");
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <span className="section-kicker">Admin workspace</span>
          <h2>Manage vote options</h2>
          <p>
            Add fresh choices, remove outdated ones, and monitor participation
            without leaving this page.
          </p>
        </div>
        <div className="admin-metrics">
          <div className="stat-card stat-card-compact">
            <span className="stat-label">Options</span>
            <strong>{votes.length}</strong>
          </div>
          <div className="stat-card stat-card-compact">
            <span className="stat-label">Total votes</span>
            <strong>{totalVotes}</strong>
          </div>
        </div>
      </div>

      <div className="add-option-form">
        <input
          type="text"
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          placeholder="Add voting option"
        />
        <button onClick={handleAddOption}>Add Option</button>
      </div>

      <div className="current-options">
        <h3>Current Options</h3>

        {votes.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h3>No options created yet</h3>
            <p>Add your first option above to start the poll.</p>
          </div>
        ) : (
          votes.map((vote, index) => (
            <div className="option-item" key={index}>
              <div className="option-left">
                <span className="vote-pill">Option {index + 1}</span>
                <span className="option-label">{vote.option}</span>
                <span className="createdBy">
                  {vote.votes} vote{vote.votes === 1 ? "" : "s"}
                </span>
              </div>

              <button
                onClick={() => handleDeleteOption(vote._id)}
                className="delete-btn"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
