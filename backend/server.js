const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path"); // ADD THIS
const connectDatabase = require("./config/connection");
const {
  register,
  login,
  userDetails,
} = require("./controllers/user.controller");
const authenticate = require("./middlewares/auth");
const Vote = require("./models/vote.model");
const isAdmin = require("./middlewares/adminAuth");
const User = require("./models/user.model");

const app = express();
const server = http.createServer(app);
dotenv.config();

// ========== SOCKET.IO SETUP ==========
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

connectDatabase();

// ========== MIDDLEWARES ==========
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

// ========== SERVE REACT BUILD IN PRODUCTION (CRITICAL) ==========
if (process.env.NODE_ENV === "production") {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, "../frontend/build")));

  // Catch-all: send index.html for any non-API route
  app.get("*", (req, res, next) => {
    // Let API routes handle /api/* first
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  });
}

// ========== API ROUTES (AFTER static files) ==========
app.post("/api/register", register);
app.post("/api/login", login);
app.get("/api/me", authenticate, userDetails);

// Create vote (admin only)
app.post("/api/votes", authenticate, isAdmin, async (req, res) => {
  try {
    const { option } = req.body;
    const vote = await Vote.create({
      option,
      createdBy: req.user?._id,
    });

    io.emit("voteCreated", vote);
    res.status(201).json(vote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all votes
app.get("/api/vote", async (req, res) => {
  try {
    const votes = await Vote.find().populate("createdBy", "email");
    res.status(200).json(votes);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit vote
app.post("/api/vote/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.votedFor) {
      return res.status(400).json({ error: "You have already voted" });
    }

    const vote = await Vote.findByIdAndUpdate(
      id,
      { $inc: { votes: 1 } },
      { new: true }
    );

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      { votedFor: id },
      { new: true }
    );

    io.emit("voteUpdated", vote);
    res.status(200).json({ vote, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete vote (admin only)
app.delete("/api/vote/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Vote.findByIdAndDelete(id);
    io.emit("voteDeleted", id);
    res.status(200).json({ message: "Vote deleted successfully", success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========== SOCKET.IO EVENTS ==========
io.on("connection", (socket) => {
  console.log("New Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  socket.on("helloServer", (msg) => {
    console.log("Client says:", msg);
    socket.emit("helloClient", "Hello from server!");
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
