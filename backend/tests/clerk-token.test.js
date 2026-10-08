const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const clerk = require("../clerk");

test("Clerk SDK checks signatures, expiry and the allowed frontend origin", async t => {
  process.env.NODE_ENV = "test";
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-signing-key", alg: "RS256", use: "sig" };
  process.env.CLERK_SECRET_KEY = "sk_test_isolated_test_key";
  process.env.CLIENT_URL = "http://localhost:5001";
  // Intercept only JWKS: no real Clerk credentials or outbound calls in tests.
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://api.clerk.com/v1/jwks");
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const now = Math.floor(Date.now() / 1000);
  function token(changes = {}, signingKey = privateKey) {
    return jwt.sign({ sub: "user_test", sid: "sess_test", azp: "http://localhost:5001", iss: "https://voting-test.clerk.accounts.dev", iat: now, nbf: now - 2, exp: now + 60, ...changes }, signingKey, { algorithm: "RS256", keyid: jwk.kid });
  }
  assert.equal((await clerk.verifySession(token())).sub, "user_test");
  await assert.rejects(clerk.verifySession(token({}, other.privateKey)));
  await assert.rejects(clerk.verifySession(token({ exp: now - 60 })));
  await assert.rejects(clerk.verifySession(token({ azp: "https://other-app.example.com" })));
  await assert.rejects(clerk.verifySession(token({ azp: undefined })));
  await assert.rejects(clerk.verifySession("invalid-token"));
  delete process.env.CLERK_SECRET_KEY;
  assert.throws(() => clerk.configuration(), /not configured/);
});
