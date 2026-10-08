const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const database = "voting_app_test_" + crypto.randomBytes(8).toString("hex");
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/" + database;
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.SERVE_FRONTEND = "false";
const identities = require("./helpers/clerk")();
const { start, io } = require("../server");
const ClerkUser = require("../models/clerk-user.model");
const LegacyUser = require("../models/user.model");
const Poll = require("../models/poll.model");
const Draft = require("../models/draft.model");

test("verified Clerk identities and legacy account isolation", async t => {
  const server = await start(0);
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise(resolve => io.close(resolve));
    assert.equal(mongoose.connection.name, database);
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  async function request(path, method = "GET", body, token) {
    const response = await fetch(base + "/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const old = await LegacyUser.create({ username: "Legacy organizer", email: "same@example.com", password: "old-password" });
  const oldPoll = await Poll.create({ createdBy: old._id, question: "Old poll", options: [{ label: "A" }, { label: "B" }] });
  // Simulate an actual pre-upgrade document with no discriminator field.
  await Poll.collection.updateOne({ _id: oldPoll._id }, { $unset: { createdByModel: "" } });
  const oldDraft = await Draft.create({ createdBy: old._id });
  const fresh = identities.identity("Fresh organizer", old.email);
  let user;
  await t.test("same email never links to an old user, poll, draft, or role", async () => {
    const result = await request("/me", "GET", null, fresh.token);
    assert.equal(result.status, 200); user = result.data;
    assert.notEqual(user._id, old.id); assert.equal(user.role, "user");
    assert.equal(user.emailVerified, true);
    assert.equal(await LegacyUser.countDocuments(), 1);
    assert.equal((await request("/polls/" + oldPoll.id)).data.organizer, "Legacy organizer");
    assert.equal((await request("/polls/" + oldPoll.id + "/close", "POST", null, fresh.token)).status, 403);
    assert.equal((await request("/polls/" + oldPoll.id + "/duplicate", "POST", null, fresh.token)).status, 404);
    assert.equal((await request("/drafts/" + oldDraft.id, "GET", null, fresh.token)).status, 404);
    assert.deepEqual((await request("/drafts", "GET", null, fresh.token)).data, []);
  });
  await t.test("old JWTs and signup endpoints cannot bypass Clerk", async () => {
    const token = jwt.sign({ id: old.id }, process.env.JWT_SECRET);
    assert.equal((await request("/me", "GET", null, token)).status, 401);
    assert.equal((await request("/polls", "POST", { question: "No", options: ["A", "B"] }, token)).status, 401);
    for (const path of ["/register", "/login"]) assert.equal((await request(path, "POST", { email: old.email, password: "old-password" })).status, 410);
    assert.equal((await request("/me")).status, 401);
    assert.equal((await request("/polls")).status, 200);
    const pending = identities.identity("Pending", "pending@example.com");
    identities.sessions.get(pending.token).sts = "pending";
    assert.equal((await request("/me", "GET", null, pending.token)).status, 401);
  });
  await t.test("concurrent first requests create only one Clerk account", async () => {
    const concurrent = identities.identity("Concurrent", "concurrent@example.com");
    const results = await Promise.all(Array.from({ length: 8 }, () => request("/me", "GET", null, concurrent.token)));
    assert.ok(results.every(result => result.status === 200));
    assert.equal(new Set(results.map(result => result.data._id)).size, 1);
    assert.equal(await ClerkUser.countDocuments({ clerkId: concurrent.id }), 1);
  });
  await t.test("unverified primary email is blocked even with a verified secondary address", async () => {
    const unverified = identities.identity("Unverified", "random@example.com", false);
    unverified.profile.emailAddresses.push({ id: "secondary", emailAddress: "verified@example.com", verification: { status: "verified" } });
    for (const [path, method, body] of [["/me", "GET"], ["/drafts", "POST", {}], ["/polls", "POST", {}], ["/polls/" + oldPoll.id + "/votes", "POST", { optionId: oldPoll.options[0].id }]]) {
      const result = await request(path, method, body, unverified.token);
      assert.equal(result.status, 403); assert.equal(result.data.code, "EMAIL_NOT_VERIFIED");
    }
    assert.equal(await ClerkUser.countDocuments({ clerkId: unverified.id }), 0);
    unverified.profile.emailAddresses[0].verification.status = "verified";
    assert.equal((await request("/me", "GET", null, unverified.token)).status, 200);
  });
  await t.test("changed verification status, banned users and deleted Clerk accounts are rejected", async () => {
    fresh.profile.emailAddresses[0].verification.status = "unverified";
    assert.equal((await request("/me", "GET", null, fresh.token)).status, 403);
    fresh.profile.emailAddresses[0].verification.status = "verified";
    fresh.profile.banned = true;
    assert.equal((await request("/me", "GET", null, fresh.token)).status, 403);
    fresh.profile.banned = false;
    identities.revoke(fresh.token);
    assert.equal((await request("/me", "GET", null, fresh.token)).status, 401);
  });
});
