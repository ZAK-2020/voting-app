const { Schema, model } = require("mongoose");

// Separate collection keeps drafts out of every public poll/query/join endpoint.
const schema = new Schema({
  question: { type: String, default: "", maxlength: 180 },
  options: { type: [String], default: ["", ""] },
  resultsVisibility: { type: String, enum: ["always", "after_vote", "after_close"], default: "always" },
  closesAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  state: { type: String, enum: ["draft", "publishing"], default: "draft" },
}, { timestamps: true });
schema.index({ createdBy: 1, updatedAt: -1 });
module.exports = model("Draft", schema);
