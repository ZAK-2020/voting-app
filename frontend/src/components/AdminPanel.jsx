import React, { useState } from 'react'

const AdminPanel = ({votes,setVotes,showNotification}) => {

  const [newOption, setNewOption] = useState('');

 const handleAddOption = async () => {
  if (!newOption?.trim()) return;
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API}/api/votes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ option: newOption }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    setNewOption('');
    showNotification("Option added successfully", "success");

    // Let the WebSocket event update the vote list

  } catch (error) {
    console.error("Error adding option:", error);
    showNotification("Error adding option", "error");
  }
};

  const handleDeleteOption = async (id ) =>{
  try {
    const response = await fetch(
        `${process.env.REACT_APP_API}/api/vote/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );
       if(!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
      const data = await response.json();
      setVotes((prev) => prev.filter(vote => vote._id !== id));
      showNotification("Option deleted successfully", "success");
  } catch (error) {
      console.error("Error deleting option:", error);
      showNotification("Error deleting option", "error");
  }

  };
 return (
  <div className="admin-panel">
    <h2>Admin Panel</h2>

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
      {
        votes.map((vote, index) => (
          <div className='option-item' key={index}>
            <div className="option-left">
              <span className="option-label">{vote.option}</span>
              <span className="vote-count">{vote.votes}</span>
            </div>
            <button onClick={() => handleDeleteOption(vote._id)} className='delete-btn'>
              Delete
            </button>
          </div>
        ))
      }
    </div>
  </div>
);

}

export default AdminPanel