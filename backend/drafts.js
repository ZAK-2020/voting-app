const { Router } = require("express");
const mongoose = require("mongoose");
const Draft = require("./models/draft.model");
const Poll = require("./models/poll.model");
const authenticate = require("./middlewares/auth");
const pollInput = require("./poll-input");
const { withJoinCode } = require("./join-codes");

const draftView = draft => ({ _id: draft._id, question: draft.question, options: draft.options, closesAt: draft.closesAt, resultsVisibility: draft.resultsVisibility, version: draft.__v, state: draft.state, updatedAt: draft.updatedAt });

module.exports = function draftRoutes(io) {
  const router = Router();
  router.use(authenticate);
  router.param("id", (req, res, next, id) => mongoose.isObjectIdOrHexString(id) ? next() : res.status(400).json({ error: "Invalid draft link." }));
  router.get("/", async (req, res) => res.json((await Draft.find({ createdBy: req.user._id }).sort({ updatedAt: -1 })).map(draftView)));
  router.post("/", async (req, res) => {
    const draft = await Draft.create({ ...pollInput(req.body, false), createdBy: req.user._id });
    res.status(201).json(draftView(draft));
  });
  router.get("/:id", async (req, res) => {
    const draft = await Draft.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!draft) return res.status(404).json({ error: "This draft could not be found." });
    res.json(draftView(draft));
  });
  router.put("/:id", async (req, res) => {
    const input = pollInput(req.body, false);
    if (!Number.isInteger(req.body.version)) return res.status(400).json({ error: "Reload this draft before saving." });
    const draft = await Draft.findOneAndUpdate({ _id: req.params.id, createdBy: req.user._id, __v: req.body.version, state: "draft" }, { $set: input, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!draft) return res.status(409).json({ error: "This draft changed or was published in another tab. Reload it before saving." });
    res.json(draftView(draft));
  });
  router.post("/:id/publish", async (req, res) => {
    // A fixed poll ID makes retrying or concurrently publishing the same draft
    // idempotent, without requiring a MongoDB replica set/transaction.
    const existing = await Poll.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (existing) {
      await Draft.deleteOne({ _id: existing._id, createdBy: req.user._id });
      return res.json({ pollId: existing.id });
    }
    if (!Number.isInteger(req.body?.version)) return res.status(400).json({ error: "Reload this draft before publishing." });
    const draft = await Draft.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!draft) return res.status(404).json({ error: "This draft could not be found." });
    if (draft.__v !== req.body.version) return res.status(409).json({ error: "This draft changed in another tab. Reload and preview the latest version." });
    // Resume the already validated snapshot after an interrupted publication,
    // even when its deadline passed while the server was unavailable.
    const input = pollInput({ ...draft.toObject(), ...(draft.state === "publishing" ? { closesAt: null } : {}) }, true);
    if (draft.state === "publishing") input.closesAt = draft.closesAt;
    const locked = await Draft.findOneAndUpdate({ _id: draft._id, createdBy: req.user._id, __v: draft.__v, state: { $in: ["draft", "publishing"] } }, { $set: { state: "publishing" } }, { new: true });
    if (!locked) return res.status(409).json({ error: "The draft changed. Reload it and try again." });
    let published;
    try {
      published = await withJoinCode(joinCode => Poll.create({ ...input, _id: draft._id, options: input.options.map(label => ({ label })), createdBy: req.user._id, joinCode }));
    } catch (error) {
      // A simultaneous publish may already have created exactly this poll.
      published = await Poll.findOne({ _id: draft._id, createdBy: req.user._id });
      if (!published) {
        // Retain the immutable publishing snapshot for a safe retry.
        throw error;
      }
    }
    await Draft.deleteOne({ _id: draft._id, createdBy: req.user._id });
    io.emit("pollChanged", { id: published.id });
    res.status(201).json({ pollId: published.id });
  });
  return router;
};
