const userDetails = (req, res) => res.json({
  _id: req.user._id,
  username: req.user.username,
  email: req.user.email,
  role: req.user.role,
  emailVerified: true,
});
module.exports = { userDetails };
