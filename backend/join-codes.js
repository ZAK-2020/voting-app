const { randomInt } = require("node:crypto");
const Poll = require("./models/poll.model");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = () =>
  Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(
    "",
  );

// The unique index is the authority; retries handle collisions and multiple servers.
async function withJoinCode(write, generate = generateCode) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await write(generate());
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.joinCode) throw error;
    }
  }
  throw new Error("Unable to allocate a join code. Please try again.");
}

async function backfillJoinCodes() {
  const missing = {
    $or: [{ joinCode: { $exists: false } }, { joinCode: null }],
  };
  for await (const poll of Poll.find(missing).select("_id").cursor()) {
    await withJoinCode((joinCode) =>
      Poll.updateOne(
        { _id: poll._id, ...missing },
        { $set: { joinCode } },
        { timestamps: false },
      ),
    );
  }
}
module.exports = { withJoinCode, backfillJoinCodes };
