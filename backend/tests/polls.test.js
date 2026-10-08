const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { io: client } = require("socket.io-client");
const { once } = require("node:events");
const crypto = require("node:crypto");

// Always use a new, disposable LOCAL database; never read a configured cloud URI.
const database = "voting_app_test_" + crypto.randomBytes(8).toString("hex");
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/" + database;
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.SERVE_FRONTEND = "false";
const { start, io } = require("../server");
const Poll = require("../models/poll.model");
const identities = require("./helpers/clerk")();
const { withJoinCode, backfillJoinCodes } = require("../join-codes");

test("independent polls, privacy, concurrent votes and lifecycle", async t => {
  const server = await start(0);
  const base = "http://127.0.0.1:" + server.address().port;
  const socket = client(base, { transports: ["websocket"] });
  t.after(async () => {
    socket.disconnect();
    await new Promise(resolve => io.close(resolve));
    assert.equal(mongoose.connection.name, database);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await once(socket, "connect");
  async function request(path, method = "GET", body, token) {
    const response = await fetch(base + "/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  let owner, voter, poll, second;
  await t.test("Clerk accounts return only public user fields", async () => {
    owner = await identities.account(request, "Organizer", "owner@example.com");
    voter = await identities.account(request, "Voter", "voter@example.com");
    assert.equal(owner.user.username, "Organizer");
    assert.deepEqual(Object.keys(owner.user).sort(), ["_id", "email", "emailVerified", "role", "username"]);
    assert.equal((await request("/me", "GET", null, owner.token)).data.password, undefined);
  });
  await t.test("poll creation requires authentication and validates options and deadlines", async () => {
    assert.equal((await request("/polls", "POST", { question: "Q", options: ["A", "B"] })).status, 401);
    for (const body of [{ question: "Q", options: ["A", " a "] }, { question: "Q", options: ["A"] }, { question: "Q", options: ["A", "B"], closesAt: "2020-01-01" }]) {
      assert.equal((await request("/polls", "POST", body, owner.token)).status, 400);
    }
    const event = once(socket, "pollChanged");
    const created = await request("/polls", "POST", { question: "Where should we meet?", options: ["Park", "Cafe"] }, owner.token);
    assert.equal(created.status, 201);
    poll = created.data;
    assert.equal((await event)[0].id, poll._id);
    assert.equal(poll.organizer, "Organizer");
    assert.equal(poll.ballots, undefined);
    second = (await request("/polls", "POST", { question: "Which day?", options: ["Friday", "Saturday"] }, owner.token)).data;
  });
  await t.test("concurrent submissions count once and receipts stay private", async () => {
    const invalid = await request("/polls/" + poll._id + "/votes", "POST", { optionId: second.options[0]._id }, voter.token);
    assert.equal(invalid.status, 409);
    const votes = await Promise.all(Array.from({ length: 16 }, (_, i) => request("/polls/" + poll._id + "/votes", "POST", { optionId: poll.options[i % 2]._id }, voter.token)));
    assert.equal(votes.filter(vote => vote.status === 201).length, 1);
    assert.equal(votes.filter(vote => vote.status === 409).length, 15);
    const voted = votes.find(vote => vote.status === 201).data;
    const detail = (await request("/polls/" + poll._id)).data;
    assert.equal(detail.totalVotes, 1);
    assert.equal(detail.options.reduce((sum, option) => sum + option.votes, 0), 1);
    assert.equal(detail.ballots, undefined);
    assert.equal(detail.email, undefined);
    assert.equal((await request("/polls/" + poll._id + "/ballot", "GET", null, voter.token)).data.optionId, voted.optionId);
    assert.equal((await request("/polls/" + poll._id + "/ballot", "GET", null, owner.token)).data.optionId, null);
    assert.equal((await request("/polls/" + poll._id + "/ballot")).status, 401);
    assert.equal((await request("/polls/" + second._id + "/votes", "POST", { optionId: second.options[0]._id }, voter.token)).status, 201);
  });
  await t.test("join codes are unique, normalized, public, and never disclose receipts", async () => {
    assert.match(poll.joinCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.notEqual(poll.joinCode, second.joinCode);
    const formatted = poll.joinCode.slice(0, 3).toLowerCase() + "-" + poll.joinCode.slice(3).toLowerCase();
    const joined = await request("/join/" + formatted);
    assert.equal(joined.status, 200);
    assert.deepEqual(joined.data, { pollId: poll._id });
    assert.equal((await request("/join/ABC")).status, 400);
    assert.equal((await request("/join/000000")).status, 400);
    const missing = ["ZZZZZZ", "YYYYYY", "XXXXXX"].find(code => code !== poll.joinCode && code !== second.joinCode);
    assert.equal((await request("/join/" + missing)).status, 404);
    await assert.rejects(Poll.updateOne({ _id: second._id }, { $set: { joinCode: poll.joinCode } }), error => error.code === 11000);
    assert.equal((await request("/polls/" + second._id)).data.joinCode, second.joinCode);
    let attempts = 0;
    const value = await withJoinCode(async code => {
      attempts++;
      if (attempts === 1) throw Object.assign(new Error("collision"), { code: 11000, keyPattern: { joinCode: 1 } });
      return code;
    }, () => "ABC234");
    assert.equal(value, "ABC234");
    assert.equal(attempts, 2);
    await assert.rejects(withJoinCode(async () => { throw new Error("Database offline"); }), /Database offline/);
  });
  await t.test("only the creator can close; closed polls refuse votes", async () => {
    assert.equal((await request("/polls/" + poll._id + "/close", "POST", null, voter.token)).status, 403);
    assert.equal((await request("/polls/" + poll._id + "/close", "POST", null, owner.token)).data.status, "closed");
    assert.equal((await request("/join/" + poll.joinCode)).data.pollId, poll._id);
    assert.equal((await request("/polls/" + poll._id + "/votes", "POST", { optionId: poll.options[0]._id }, owner.token)).status, 409);
  });
  await t.test("scheduled deadlines and capacity are enforced by the database write", async () => {
    await Poll.updateOne({ _id: second._id }, { $set: { closesAt: new Date(Date.now() - 1000) } });
    assert.equal((await request("/polls/" + second._id)).data.status, "closed");
    assert.equal((await request("/polls/" + second._id + "/votes", "POST", { optionId: second.options[1]._id }, owner.token)).status, 409);
    await Poll.updateOne({ _id: second._id }, { $set: { closesAt: null, totalVotes: 10000 } });
    assert.equal((await request("/polls/" + second._id + "/votes", "POST", { optionId: second.options[1]._id }, owner.token)).status, 409);
  });
  await t.test("invalid links, deleted accounts and retired endpoints fail safely", async () => {
    assert.equal((await request("/polls/invalid")).status, 400);
    assert.equal((await request("/polls/" + new mongoose.Types.ObjectId())).status, 404);
    assert.equal((await request("/vote")).status, 410);
    const list = await request("/polls");
    assert.equal(list.data.length, 2);
    assert.ok(list.data.every(item => !item.ballots));
    identities.revoke(voter.token);
    assert.equal((await request("/me", "GET", null, voter.token)).status, 401);
  });
  await t.test("existing polls get permanent codes without changing votes or timestamps", async () => {
    const before = new Date("2025-01-01T00:00:00Z");
    const legacy = await Poll.create({ question: "Existing poll", createdBy: owner.user._id, options: [{ label: "A", votes: 2 }, { label: "B", votes: 0 }], totalVotes: 2 });
    await Poll.collection.updateOne({ _id: legacy._id }, { $set: { updatedAt: before } });
    await backfillJoinCodes();
    const after = await Poll.findById(legacy._id);
    assert.match(after.joinCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(after.totalVotes, 2);
    assert.equal(after.options[0].votes, 2);
    assert.equal(after.updatedAt.getTime(), before.getTime());
    await backfillJoinCodes();
    assert.equal((await Poll.findById(legacy._id)).joinCode, after.joinCode);
    assert.equal((await request("/join/" + after.joinCode)).data.pollId, legacy.id);
  });
  await t.test("visibility rules strip results from all responses until eligible", async () => {
    const participant = await identities.account(request, "Participant", "privacy@example.com");
    const hidden = data => {
      assert.equal(data.resultsVisible, false);
      assert.ok(data.options.every(option => !Object.hasOwn(option, "votes")));
      assert.equal(data.ballots, undefined);
    };
    assert.equal((await request("/polls", "POST", { question: "Q", options: ["A", "B"], resultsVisibility: "invalid" }, owner.token)).status, 400);
    for (const mode of ["after_vote", "after_close"]) {
      const created = await request("/polls", "POST", { question: mode, options: ["A", "B"], resultsVisibility: mode }, owner.token);
      hidden(created.data);
      const id = created.data._id;
      const endpoint = "/polls/" + id;
      for (const token of [undefined, owner.token, participant.token]) hidden((await request(endpoint, "GET", null, token)).data);
      assert.equal((await request(endpoint, "GET", null, "bad-token")).status, 401);
      const event = once(socket, "pollChanged");
      const vote = await request(endpoint + "/votes", "POST", { optionId: created.data.options[0]._id }, participant.token);
      assert.equal(vote.status, 201);
      assert.deepEqual((await event)[0], { id });
      if (mode === "after_close") hidden(vote.data.poll);
      else { assert.equal(vote.data.poll.resultsVisible, true); assert.equal(vote.data.poll.options[0].votes, 1); }
      hidden((await request(endpoint)).data);
      hidden((await request(endpoint, "GET", null, owner.token)).data);
      hidden((await request(endpoint + "?view=presentation", "GET", null, participant.token)).data);
      const ownView = (await request(endpoint, "GET", null, participant.token)).data;
      assert.equal(ownView.resultsVisible, mode === "after_vote");
      const publicList = (await request("/polls")).data.find(poll => poll._id === id);
      hidden(publicList);
      const ownList = (await request("/polls", "GET", null, participant.token)).data.find(poll => poll._id === id);
      assert.equal(ownList.resultsVisible, mode === "after_vote");
      assert.equal((await request(endpoint + "/ballot", "GET", null, participant.token)).data.optionId, created.data.options[0]._id);
      const cache = await fetch(base + "/api" + endpoint);
      assert.equal(cache.headers.get("cache-control"), "no-store");
      if (mode === "after_close") await Poll.updateOne({ _id: id }, { $set: { closesAt: new Date(Date.now() - 1000) } });
      else assert.equal((await request(endpoint + "/close", "POST", null, owner.token)).data.resultsVisible, true);
      for (const suffix of ["", "?view=presentation"]) {
        const revealed = (await request(endpoint + suffix)).data;
        assert.equal(revealed.resultsVisible, true);
        assert.equal(revealed.options[0].votes, 1);
      }
    }
    // Pre-upgrade polls keep their existing public-results behavior.
    await Poll.collection.updateOne({ _id: new mongoose.Types.ObjectId(poll._id) }, { $unset: { resultsVisibility: "" } });
    assert.equal((await request("/polls/" + poll._id)).data.resultsVisibility, "always");
  });
  await t.test("archive and restore preserve votes, links, and closed status", async () => {
    const stranger = await identities.account(request, "Stranger", "archive@example.com");
    const fresh = (await request("/polls", "POST", { question: "Archive lifecycle", options: ["A", "B"] }, owner.token)).data;
    const url = "/polls/" + fresh._id;
    assert.equal((await request(url + "/archive", "POST", null, owner.token)).status, 409);
    await request(url + "/votes", "POST", { optionId: fresh.options[0]._id }, owner.token);
    await request(url + "/close", "POST", null, owner.token);
    assert.equal((await request(url + "/archive", "POST", null, stranger.token)).status, 409);
    assert.equal((await request(url + "/archive", "POST")).status, 401);
    const archived = (await request(url + "/archive", "POST", null, owner.token)).data;
    assert.ok(archived.archivedAt); assert.equal(archived.totalVotes, 1);
    assert.equal((await request("/polls")).data.some(item => item._id === fresh._id), false);
    assert.equal((await request("/polls?archived=true")).data.some(item => item._id === fresh._id), true);
    assert.equal((await request("/join/" + fresh.joinCode)).data.pollId, fresh._id);
    assert.equal((await request(url)).data.options[0].votes, 1);
    assert.equal((await request(url + "/restore", "POST", null, stranger.token)).status, 404);
    const restored = (await request(url + "/restore", "POST", null, owner.token)).data;
    assert.equal(restored.archivedAt, null); assert.equal(restored.closedAt, archived.closedAt); assert.equal(restored.status, "closed");
    assert.equal((await request(url + "/votes", "POST", { optionId: fresh.options[1]._id }, stranger.token)).status, 409);
    assert.equal((await request("/polls")).data.some(item => item._id === fresh._id), true);
    assert.equal((await request("/polls?archived=true")).data.some(item => item._id === fresh._id), false);
    const scheduled = (await request("/polls", "POST", { question: "Scheduled", options: ["A", "B"] }, owner.token)).data;
    await Poll.updateOne({ _id: scheduled._id }, { $set: { closesAt: new Date(Date.now() - 1000) } });
    assert.equal((await request("/polls/" + scheduled._id + "/archive", "POST", null, owner.token)).status, 200);
  });
  await t.test("CSV export respects owner permissions and visibility, including after voting", async () => {
    const outsider = await identities.account(request, "Outsider", "outsider@example.com");
    for (const mode of ["always", "after_vote", "after_close"]) {
      const fresh = (await request("/polls", "POST", { question: '=SUM(1,2)', options: ['=2+2', 'A, "quoted" choice'], resultsVisibility: mode }, owner.token)).data;
      const url = base + "/api/polls/" + fresh._id + "/export";
      const headers = { Authorization: "Bearer " + owner.token };
      assert.equal((await fetch(url)).status, 401);
      assert.equal((await fetch(url, { headers: { Authorization: "Bearer " + outsider.token } })).status, 404);
      const initial = await fetch(url, { headers });
      assert.equal(initial.status, mode === "always" ? 200 : 403);
      if (mode === "always") assert.match(await initial.text(), /"0.00"/);
      await request("/polls/" + fresh._id + "/votes", "POST", { optionId: fresh.options[0]._id }, owner.token);
      assert.equal((await fetch(url, { headers })).status, mode === "after_close" ? 403 : 200);
      await request("/polls/" + fresh._id + "/close", "POST", null, owner.token);
      await request("/polls/" + fresh._id + "/archive", "POST", null, owner.token);
      const result = await fetch(url, { headers });
      assert.equal(result.status, 200);
      assert.match(result.headers.get("content-type"), /text\/csv/);
      assert.match(result.headers.get("content-disposition"), /attachment; filename="gather-/);
      assert.equal(result.headers.get("cache-control"), "no-store");
      const csv = await result.text();
      assert.ok(csv.includes(`"'=SUM(1,2)"`));
      assert.ok(csv.includes(`"'=2+2"`));
      assert.ok(csv.includes('"A, ""quoted"" choice"'));
      assert.ok(csv.includes('"100.00"'));
      assert.ok(csv.includes('"Closed"'));
      assert.ok(!csv.includes(owner.user.email));
      assert.ok(!csv.includes("ballots"));
    }
  });
});
