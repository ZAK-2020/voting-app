const { mock } = require("node:test");
const crypto = require("node:crypto");
const clerk = require("../../clerk");

// Only the external identity service is mocked; HTTP routes and MongoDB are real.
module.exports = function mockClerk() {
  const profiles = new Map();
  const sessions = new Map();
  mock.method(clerk, "verifySession", async token => {
    if (!sessions.has(token)) throw new Error("Invalid session");
    return sessions.get(token);
  });
  mock.method(clerk, "getUser", async id => {
    if (!profiles.has(id)) throw Object.assign(new Error("Deleted account"), { status: 404 });
    return profiles.get(id);
  });
  function identity(username, email, verified = true) {
    const id = "user_" + crypto.randomBytes(10).toString("hex");
    const token = crypto.randomBytes(24).toString("hex");
    const profile = { id, firstName: username, primaryEmailAddressId: "primary", emailAddresses: [{ id: "primary", emailAddress: email, verification: { status: verified ? "verified" : "unverified" } }] };
    profiles.set(id, profile); sessions.set(token, { sub: id, sid: "sess_test" });
    return { id, token, profile };
  }
  async function account(request, username, email) {
    const record = identity(username, email);
    const result = await request("/me", "GET", null, record.token);
    if (result.status !== 200) throw new Error(JSON.stringify(result));
    return { ...record, user: result.data };
  }
  return { identity, account, profiles, sessions, revoke: token => profiles.delete(sessions.get(token).sub) };
};
