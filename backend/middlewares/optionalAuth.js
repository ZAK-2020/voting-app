const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
module.exports = async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return next(); }
  req.user = await User.findById(decoded.id);
  next();
};
