const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const publicUser = (user) => ({
  _id: user._id,
  username: user.username || "Member",
  email: user.email,
  role: user.role,
});
const session = (user) => ({
  token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" }),
  user: publicUser(user),
});
const register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (
    typeof username !== "string" ||
    !username.trim() ||
    username.trim().length > 60 ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password) > 72
  ) {
    return res.status(400).json({
      error:
        "Enter a display name, valid email, and a password of at least 8 characters (up to 72 bytes).",
    });
  }
  try {
    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    res.status(201).json(session(user));
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    throw error;
  }
};
const login = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string")
    return res.status(400).json({ error: "Enter your email and password." });
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password",
  );
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ error: "Email or password is incorrect." });
  res.json(session(user));
};
const userDetails = (req, res) => res.json(publicUser(req.user));
module.exports = { register, login, userDetails };
