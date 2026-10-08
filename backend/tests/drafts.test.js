const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { io: client } = require("socket.io-client");
const { once } = require("node:events");
const database = "voting_app_test_" + crypto.randomBytes(8).toString("hex");
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/" + database;
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.SERVE_FRONTEND = "false";
const { start, io } = require("../server");
const Poll = require("../models/poll.model");
const Draft = require("../models/draft.model");
const { backfillJoinCodes } = require("../join-codes");

test("private drafts, preview-ready validation, publishing and duplication", async t => {
  const server = await start(0);
  const base = "http://127.0.0.1:" + server.address().port;
  const socket = client(base, { transports: ["websocket"] });
  t.after(async () => { socket.disconnect(); await new Promise(resolve => io.close(resolve)); assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await once(socket, "connect");
  const events = [];
  socket.on("pollChanged", data => events.push(data));
  async function request(path, method = "GET", body, token) {
    const response = await fetch(base + "/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const owner = (await request("/register", "POST", { username: "Owner", email: "owner@example.com", password: "testing-password" })).data;
  const other = (await request("/register", "POST", { username: "Other", email: "other@example.com", password: "testing-password" })).data;
  let draft;
  const contents = { question: "Where next?", options: ["Park", "Cafe"], resultsVisibility: "after_close", closesAt: null };
  await t.test("unfinished drafts can be saved and only their creator can read them", async () => {
    assert.equal((await request("/drafts")).status, 401);
    draft = (await request("/drafts", "POST", { question: "", options: ["", ""] }, owner.token)).data;
    assert.equal(draft.question, ""); assert.equal(draft.version, 0);
    assert.equal((await request("/drafts/" + draft._id, "GET", null, other.token)).status, 404);
    assert.equal((await request("/drafts", "GET", null, other.token)).data.length, 0);
    assert.equal((await request("/drafts", "GET", null, owner.token)).data.length, 1);
    assert.equal((await request("/polls")).data.length, 0);
    for (const suffix of ["", "?view=presentation", "/ballot"]) assert.equal((await request("/polls/" + draft._id + suffix, "GET", null, owner.token)).status, 404);
    assert.equal((await request("/drafts/" + draft._id + "/publish", "POST", { version: 0 }, other.token)).status, 404);
    assert.equal((await request("/drafts/" + draft._id + "/publish", "POST", { version: 0 }, owner.token)).status, 400);
    await backfillJoinCodes();
    assert.equal((await Draft.findById(draft._id)).joinCode, undefined);
    assert.equal(events.length, 0);
  });
  await t.test("draft editing detects stale tabs and publishing validates the saved version", async () => {
    const updated = await request("/drafts/" + draft._id, "PUT", { ...contents, version: 0 }, owner.token);
    assert.equal(updated.status, 200); draft = updated.data; assert.equal(draft.version, 1);
    assert.equal((await request("/drafts/" + draft._id, "PUT", { ...contents, version: 0 }, owner.token)).status, 409);
    assert.equal((await request("/drafts/" + draft._id, "PUT", { ...contents, version: 1 }, other.token)).status, 409);
    assert.equal((await request("/drafts/" + draft._id + "/publish", "POST", { version: 0 }, owner.token)).status, 409);
    const invalid = (await request("/drafts", "POST", { ...contents, options: ["Same", "same"] }, owner.token)).data;
    assert.equal((await request("/drafts/" + invalid._id + "/publish", "POST", { version: 0 }, owner.token)).status, 400);
    const expired = (await request("/drafts", "POST", { ...contents, closesAt: "2020-01-01" }, owner.token)).data;
    assert.equal((await request("/drafts/" + expired._id + "/publish", "POST", { version: 0 }, owner.token)).status, 400);
  });
  await t.test("concurrent publication creates exactly one poll with a fresh join code", async () => {
    const attempts = await Promise.all(Array.from({ length: 8 }, () => request("/drafts/" + draft._id + "/publish", "POST", { version: 1 }, owner.token)));
    assert.ok(attempts.some(result => result.status === 201));
    assert.equal(await Poll.countDocuments(), 1);
    const published = (await request("/polls/" + draft._id)).data;
    assert.equal(published.question, contents.question);
    assert.equal(published.resultsVisibility, "after_close");
    assert.equal(published.totalVotes, 0); assert.match(published.joinCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal((await request("/join/" + published.joinCode)).data.pollId, draft._id);
    assert.equal(await Draft.countDocuments({ _id: draft._id }), 0);
    assert.equal((await request("/drafts/" + draft._id + "/publish", "POST", { version: 1 }, owner.token)).data.pollId, draft._id);
    assert.equal((await request("/drafts/" + draft._id, "PUT", { ...contents, question: "Changed", version: 1 }, owner.token)).status, 409);
    assert.equal((await request("/polls/" + draft._id)).data.question, contents.question);
  });
  await t.test("duplicates retain content/settings but no responses, IDs or closing date", async () => {
    const source = await Poll.findById(draft._id);
    await request("/polls/" + source.id + "/votes", "POST", { optionId: String(source.options[0]._id) }, owner.token);
    await request("/polls/" + source.id + "/close", "POST", null, owner.token);
    assert.equal((await request("/polls/" + source.id + "/duplicate", "POST", null, other.token)).status, 404);
    const copied = await request("/polls/" + source.id + "/duplicate", "POST", null, owner.token);
    assert.equal(copied.status, 201); assert.notEqual(copied.data.draftId, source.id);
    const copy = (await request("/drafts/" + copied.data.draftId, "GET", null, owner.token)).data;
    assert.equal(copy.question, source.question); assert.equal(copy.resultsVisibility, source.resultsVisibility);
    assert.deepEqual(copy.options, ["Park", "Cafe"]); assert.equal(copy.closesAt, null);
    assert.equal(copy.joinCode, undefined); assert.equal(copy.ballots, undefined);
    await request("/drafts/" + copy._id + "/publish", "POST", { version: copy.version }, owner.token);
    const second = await Poll.findById(copy._id).select("+ballots");
    assert.equal(second.totalVotes, 0); assert.equal(second.ballots.length, 0);
    assert.notEqual(second.joinCode, source.joinCode);
    assert.notEqual(String(second.options[0]._id), String(source.options[0]._id));
    assert.equal((await Poll.findById(source._id)).totalVotes, 1);
  });
  await t.test("an interrupted publication can resume safely after its deadline", async () => {
    const interrupted = await Draft.create({ ...contents, createdBy: owner.user._id, state: "publishing", closesAt: new Date(Date.now() - 1000) });
    const result = await request("/drafts/" + interrupted.id + "/publish", "POST", { version: 0 }, owner.token);
    assert.equal(result.status, 201);
    assert.equal((await request("/polls/" + interrupted.id)).data.status, "closed");
    assert.equal(await Draft.countDocuments({ _id: interrupted._id }), 0);
  });
});
