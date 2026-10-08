const clerk = require("../clerk");
const ClerkUser = require("../models/clerk-user.model");

module.exports = function clerkAuth(optional = false) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header && optional) return next();
    const token = /^Bearer ([^\s]+)$/i.exec(header || "")?.[1];
    if (!token) return res.status(401).json({ error: "Please sign in to continue." });
    let identity;
    try {
      identity = await clerk.verifySession(token);
      if (!identity.sub || !identity.sid || (identity.sts && identity.sts !== "active")) throw new Error("Not an active user session");
    } catch (error) {
      return res.status(error.status === 503 ? 503 : 401).json({ error: error.status === 503 ? error.message : "Your session has expired. Please sign in again." });
    }
    let profile;
    try { profile = await clerk.getUser(identity.sub); }
    catch (error) {
      return res.status(error.status === 404 ? 401 : 503).json({ error: error.status === 404 ? "Please sign in again." : "Unable to check your account. Please try again." });
    }
    if (profile.id !== identity.sub || profile.banned || profile.locked) {
      return res.status(403).json({ error: "This account cannot access the app." });
    }
    const email = profile.emailAddresses?.find(address => address.id === profile.primaryEmailAddressId);
    if (!email || email.verification?.status !== "verified") {
      return res.status(403).json({ error: "Verify your primary email in your account settings before continuing.", code: "EMAIL_NOT_VERIFIED" });
    }
    const username = (profile.username || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Member").trim().slice(0, 60) || "Member";
    try {
      // A unique Clerk ID makes concurrent first requests converge on one account.
      const update = { $set: { username, email: email.emailAddress.toLowerCase() }, $setOnInsert: { clerkId: identity.sub, role: "user" } };
      try {
        req.user = await ClerkUser.findOneAndUpdate({ clerkId: identity.sub }, update, { new: true, upsert: true, runValidators: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        req.user = await ClerkUser.findOneAndUpdate({ clerkId: identity.sub }, { $set: update.$set }, { new: true, runValidators: true });
        if (!req.user) throw error;
      }
      next();
    } catch (error) { next(error); }
  };
};
