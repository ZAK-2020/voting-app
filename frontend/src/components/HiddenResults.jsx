export default function HiddenResults({ poll, presentation = false }) {
  const afterVote = poll.resultsVisibility === "after_vote";
  return <section className="hidden-results" aria-label="Results visibility">
    <span className="privacy-mark" aria-hidden="true">◈</span>
    <h2>Results are hidden</h2>
    <p>{presentation ? "Results will appear on this screen when the poll closes." : afterVote ? "Cast your vote to see the results. They become public when the poll closes." : "Results will appear when the organizer closes the poll or its deadline is reached."}</p>
    {presentation && afterVote && <p>Participants can view results on their own devices after voting.</p>}
  </section>;
}
