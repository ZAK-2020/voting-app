module.exports = function pollInput(body = {}, publish = true) {
  const { question = "", options = ["", ""], resultsVisibility = "always", closesAt = null } = body;
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (typeof question !== "string" || question.trim().length > 180 || (publish && !question.trim())) fail("Add a question of up to 180 characters.");
  if (!Array.isArray(options) || options.length < 2 || options.length > 10 || options.some(value => typeof value !== "string" || value.trim().length > 100 || (publish && !value.trim()))) fail("Add 2–10 options, each up to 100 characters. Complete every option before publishing.");
  const labels = options.map(value => value.trim());
  if (publish && new Set(labels.map(value => value.toLowerCase())).size !== labels.length) fail("Each option must be different.");
  if (!["always", "after_vote", "after_close"].includes(resultsVisibility)) fail("Choose a valid results visibility setting.");
  if (closesAt !== null && closesAt !== "" && typeof closesAt !== "string" && !(closesAt instanceof Date)) fail("Choose a valid closing date.");
  const deadline = closesAt ? new Date(closesAt) : null;
  if (deadline && (!Number.isFinite(deadline.getTime()) || (publish && deadline <= new Date()))) fail("Choose a closing time in the future.");
  return { question: question.trim(), options: labels, resultsVisibility, closesAt: deadline };
};
