const { createClerkClient, verifyToken } = require("@clerk/backend");

function configuration() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const authorizedParties = (process.env.CLIENT_URL || "")
    .split(",").map(value => value.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!secretKey || !authorizedParties.length) {
    throw Object.assign(new Error("Sign-in is not configured. Please try again later."), { status: 503 });
  }
  return { secretKey, authorizedParties };
}

module.exports = {
  configuration,
  verifySession(token) {
    return verifyToken(token, configuration());
  },
  getUser(id) {
    return createClerkClient({ secretKey: configuration().secretKey }).users.getUser(id);
  },
};
