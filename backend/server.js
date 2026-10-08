const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const {
  register,
  login,
  userDetails,
} = require("./controllers/user.controller");
const authenticate = require("./middlewares/auth");
const optionalAuth = require("./middlewares/optionalAuth");
const Poll = require("./models/poll.model");
const Draft = require("./models/draft.model");
const pollInput = require("./poll-input");
const { withJoinCode, backfillJoinCodes } = require("./join-codes");
const { canViewResults } = require("./poll-policy");
const resultsCsv = require("./results-csv");

const app = express();
const server = http.createServer(app);
const origin = (process.env.CLIENT_URL || "http://localhost:5001")
  .split(",")
  .map((value) => value.trim());
const io = new Server(server, { cors: { origin, methods: ["GET", "POST"] } });
app.use(cors({ origin }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

function publicPoll(poll, hasVoted = false) {
  const resultsVisibility = poll.resultsVisibility || "always";
  const resultsVisible = canViewResults(poll, hasVoted);
  return {
    _id: poll._id,
    question: poll.question,
    options: poll.options.map(option => ({ _id: option._id, label: option.label, ...(resultsVisible ? { votes: option.votes } : {}) })),
    resultsVisibility,
    resultsVisible,
    joinCode: poll.joinCode,
    createdBy: poll.createdBy?._id || poll.createdBy,
    organizer: poll.createdBy?.username || "Community member",
    createdAt: poll.createdAt,
    closesAt: poll.closesAt,
    closedAt: poll.closedAt,
    archivedAt: poll.archivedAt || null,
    totalVotes: poll.totalVotes,
    status:
      poll.closedAt || (poll.closesAt && poll.closesAt <= new Date())
        ? "closed"
        : "open",
  };
}
const withOrganizer = (query) => query.populate("createdBy", "username");
app.use("/api/drafts", require("./drafts")(io));
app.post("/api/register", register);
app.post("/api/login", login);
app.get("/api/me", authenticate, userDetails);
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 }),
);
app.get("/api/join/:code", async (req, res) => {
  const code = req.params.code.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code))
    return res
      .status(400)
      .json({ error: "Enter the six-character code shown by the organizer." });
  const poll = await Poll.findOne({ joinCode: code }).select("_id");
  if (!poll)
    return res
      .status(404)
      .json({ error: "No poll matches that code. Check it and try again." });
  res.json({ pollId: poll.id });
});

app.get("/api/polls", optionalAuth, async (req, res) => {
  const archive = req.query.archived === "true";
  const polls = await withOrganizer(Poll.find({ archivedAt: archive ? { $ne: null } : null }).sort(archive ? { archivedAt: -1 } : { createdAt: -1 }));
  const voted = req.user ? await Poll.find({ "ballots.user": req.user._id }).select("_id").lean() : [];
  const votedIds = new Set(voted.map(poll => String(poll._id)));
  res.json(polls.map(poll => publicPoll(poll, votedIds.has(poll.id))));
});
app.post("/api/polls", authenticate, async (req, res) => {
  const { question, options: labels, closesAt: deadline, resultsVisibility } = pollInput(req.body);
  const poll = await withJoinCode((joinCode) =>
    Poll.create({
      question: question.trim(),
      options: labels.map((label) => ({ label })),
      closesAt: deadline,
      createdBy: req.user._id,
      joinCode,
      resultsVisibility,
    }),
  );
  await poll.populate("createdBy", "username");
  io.emit("pollChanged", { id: poll.id });
  res.status(201).json(publicPoll(poll));
});
app.param("pollId", (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id))
    return res.status(400).json({ error: "Invalid poll link." });
  next();
});
app.post("/api/polls/:pollId/duplicate", authenticate, async (req, res) => {
  const source = await Poll.findOne({ _id: req.params.pollId, createdBy: req.user._id });
  if (!source) return res.status(404).json({ error: "Only your own polls can be duplicated." });
  const draft = await Draft.create({ question: source.question, options: source.options.map(option => option.label), resultsVisibility: source.resultsVisibility || "always", closesAt: null, createdBy: req.user._id });
  res.status(201).json({ draftId: draft.id });
});
app.get("/api/polls/:pollId/export", authenticate, async (req, res) => {
  const poll = await Poll.findOne({ _id: req.params.pollId, createdBy: req.user._id });
  if (!poll) return res.status(404).json({ error: "Only the organizer can export this poll." });
  const hasVoted = await Poll.exists({ _id: poll._id, "ballots.user": req.user._id });
  if (!canViewResults(poll, !!hasVoted)) return res.status(403).json({ error: "Results are hidden. You can export once the results become visible to you." });
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="gather-' + poll.id + '.csv"');
  res.send(resultsCsv(poll));
});
app.post("/api/polls/:pollId/archive", authenticate, async (req, res) => {
  const poll = await withOrganizer(Poll.findOneAndUpdate({
    _id: req.params.pollId, createdBy: req.user._id,
    $or: [{ closedAt: { $ne: null } }, { closesAt: { $ne: null }, $expr: { $lte: ["$closesAt", "$$NOW"] } }],
  }, { $set: { archivedAt: new Date() } }, { new: true }));
  if (!poll) return res.status(409).json({ error: "Only the organizer can archive a closed poll. Close voting first." });
  io.emit("pollChanged", { id: poll.id });
  res.json(publicPoll(poll));
});
app.post("/api/polls/:pollId/restore", authenticate, async (req, res) => {
  const poll = await withOrganizer(Poll.findOneAndUpdate({ _id: req.params.pollId, createdBy: req.user._id }, { $set: { archivedAt: null } }, { new: true }));
  if (!poll) return res.status(404).json({ error: "Only the organizer can restore this poll." });
  io.emit("pollChanged", { id: poll.id });
  res.json(publicPoll(poll));
});
app.get("/api/polls/:pollId", optionalAuth, async (req, res) => {
  const poll = await withOrganizer(Poll.findById(req.params.pollId));
  if (!poll)
    return res.status(404).json({ error: "This poll could not be found." });
  const hasVoted = req.user && req.query.view !== "presentation" && await Poll.exists({ _id: poll._id, "ballots.user": req.user._id });
  res.json(publicPoll(poll, !!hasVoted));
});
app.get("/api/polls/:pollId/ballot", authenticate, async (req, res) => {
  const poll = await Poll.findById(req.params.pollId).select({
    ballots: { $elemMatch: { user: req.user._id } },
  });
  if (!poll)
    return res.status(404).json({ error: "This poll could not be found." });
  res.json({ optionId: poll.ballots?.[0]?.option || null });
});
app.post("/api/polls/:pollId/votes", authenticate, async (req, res) => {
  const { optionId } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(optionId))
    return res.status(400).json({ error: "Choose a valid option." });
  // Eligibility, receipt and counters are one atomic operation. The database
  // clock enforces the deadline at the write, including concurrent submissions.
  const poll = await withOrganizer(
    Poll.findOneAndUpdate(
      {
        _id: req.params.pollId,
        closedAt: null,
        "options._id": optionId,
        "ballots.user": { $ne: req.user._id },
        totalVotes: { $lt: 10000 },
        $expr: {
          $or: [{ $eq: ["$closesAt", null] }, { $gt: ["$closesAt", "$$NOW"] }],
        },
      },
      {
        $inc: { "options.$.votes": 1, totalVotes: 1 },
        $push: { ballots: { user: req.user._id, option: optionId } },
      },
      { new: true },
    ),
  );
  if (!poll) {
    const existing = await Poll.findById(req.params.pollId);
    if (!existing)
      return res.status(404).json({ error: "This poll could not be found." });
    return res
      .status(409)
      .json({
        error:
          "Your vote was not added. You may have already voted, or this poll is closed, full, or the option is unavailable.",
      });
  }
  io.emit("pollChanged", { id: poll.id });
  res.status(201).json({ poll: publicPoll(poll, true), optionId });
});
app.post("/api/polls/:pollId/close", authenticate, async (req, res) => {
  const poll = await withOrganizer(
    Poll.findOneAndUpdate(
      { _id: req.params.pollId, createdBy: req.user._id, closedAt: null },
      { $set: { closedAt: new Date() } },
      { new: true },
    ),
  );
  if (!poll)
    return res
      .status(403)
      .json({ error: "Only the organizer can close an open poll." });
  io.emit("pollChanged", { id: poll.id });
  res.json(publicPoll(poll));
});
// Retire the unsafe global API while leaving legacy data untouched.
app.use(["/api/vote", "/api/votes"], (req, res) =>
  res
    .status(410)
    .json({ error: "The global ballot has been replaced. Please use polls." }),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
const buildPath = path.join(__dirname, "../frontend/build");
if (process.env.SERVE_FRONTEND === "true" && fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get(/.*/, (req, res) => res.sendFile(path.join(buildPath, "index.html")));
}
app.use((error, req, res, next) => {
  console.error(error.message);
  res
    .status(error.status === 400 || error.status === 413 ? error.status : 500)
    .json({
      error:
        error.status === 400
          ? error.message || "Invalid request."
          : "Unable to complete this request. Please try again.",
    });
});
async function start(port = process.env.PORT || 5000) {
  if (!process.env.JWT_SECRET || !process.env.MONGO_URI)
    throw new Error("MONGO_URI and JWT_SECRET must be configured.");
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Poll.init(), Draft.init(), require("./models/user.model").init()]);
  await backfillJoinCodes();
  await new Promise((resolve) => server.listen(port, resolve));
  console.log("Voting API ready on port " + server.address().port);
  return server;
}
if (require.main === module)
  start().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
module.exports = { app, server, io, start };
