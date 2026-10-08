const { Schema, model } = require("mongoose");

const pollSchema = new Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 180 },
    resultsVisibility: { type: String, enum: ["always", "after_vote", "after_close"], default: "always" },
    joinCode: { type: String, match: /^[A-HJ-NP-Z2-9]{6}$/ },
    options: [
      {
        label: { type: String, required: true, maxlength: 100 },
        votes: { type: Number, default: 0 },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, refPath: "createdByModel", required: true },
    createdByModel: { type: String, enum: ["User", "ClerkUser"], default: "User" },
    closesAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    totalVotes: { type: Number, default: 0 },
    // Private receipts and counters change in one atomic write, even on standalone MongoDB.
    ballots: {
      type: [
        {
          _id: false,
          user: Schema.Types.ObjectId,
          option: Schema.Types.ObjectId,
        },
      ],
      select: false,
      default: [],
    },
  },
  { timestamps: true },
);
pollSchema.index({ createdAt: -1 });
pollSchema.index(
  { joinCode: 1 },
  { unique: true, partialFilterExpression: { joinCode: { $type: "string" } } },
);
module.exports = model("Poll", pollSchema);
