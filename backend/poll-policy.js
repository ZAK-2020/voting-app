const isPollClosed = poll => !!(poll.closedAt || (poll.closesAt && poll.closesAt <= new Date()));
function canViewResults(poll, hasVoted = false) {
  const visibility = poll.resultsVisibility || "always";
  return visibility === "always" || isPollClosed(poll) || (visibility === "after_vote" && hasVoted);
}
module.exports = { isPollClosed, canViewResults };
