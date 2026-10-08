const { Schema, model } = require("mongoose");

// Deliberately separate from legacy password accounts. Never link by email.
const schema = new Schema({
  clerkId: { type: String, required: true, unique: true },
  username: { type: String, required: true, maxlength: 60 },
  email: { type: String, required: true },
  role: { type: String, enum: ["user"], default: "user" },
}, { timestamps: true });

module.exports = model("ClerkUser", schema);
