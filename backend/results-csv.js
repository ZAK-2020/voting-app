const { isPollClosed } = require("./poll-policy");

function cell(value) {
  let text = String(value ?? "");
  // Quoting alone does not prevent spreadsheet formula execution.
  if (typeof value === "string" && (/^[\t\r\n]/.test(text) || /^\s*[=+@-]/.test(text))) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
module.exports = function resultsCsv(poll) {
  const exportedAt = new Date();
  const closed = isPollClosed(poll);
  const closingTimes = [poll.closedAt, poll.closesAt].filter(value => value && value <= exportedAt);
  const effectiveClose = closingTimes.length ? new Date(Math.min(...closingTimes.map(value => value.getTime()))).toISOString() : "";
  const rows = [["Poll ID", "Question", "Option", "Votes", "Percentage", "Total responses", "Status", "Closed at (UTC)", "Scheduled closing (UTC)", "Archived at (UTC)", "Exported at (UTC)"]];
  for (const option of poll.options) rows.push([
    poll.id, poll.question, option.label, option.votes,
    poll.totalVotes ? (option.votes / poll.totalVotes * 100).toFixed(2) : "0.00",
    poll.totalVotes, closed ? "Closed" : "Open", effectiveClose,
    poll.closesAt?.toISOString() || "", poll.archivedAt?.toISOString() || "", exportedAt.toISOString(),
  ]);
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
};
