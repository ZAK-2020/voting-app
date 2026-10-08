import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDate } from "../api";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api("/api/drafts").then(data => { if (active) { setDrafts(data); setError(""); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [retry]);
  return <section>
    <div className="page-heading"><div><span className="eyebrow">Your private workspace</span><h1>My drafts.</h1><p>Pick up where you left off. Only you can see these polls.</p></div><Link className="button primary" to="/create">+ Create poll</Link></div>
    {error && <div className="error-message" role="alert">{error}<button className="text-button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {!drafts && !error ? <p className="page-message" role="status">Loading drafts…</p> : drafts?.length === 0 ? <div className="empty-state drafts-list"><h2>A little room to think.</h2><p>Start a poll, save your ideas, and publish when you're ready.</p><Link className="button primary" to="/create">Create a draft</Link></div> : <div className="poll-grid drafts-list">{drafts?.map(draft => <Link className="poll-card" to={"/drafts/" + draft._id + "/edit"} key={draft._id}><div className="card-top"><span className="badge draft">Private draft</span><span className="muted">{draft.options.filter(option => option.trim()).length} options</span></div><h2>{draft.question || "Untitled poll"}</h2><p className="organizer">Saved {formatDate(draft.updatedAt)}</p><div className="card-bottom"><span>{draft.state === "publishing" ? "Finish publishing" : "Continue editing"}</span><span className="card-arrow" aria-hidden="true">↗</span></div></Link>)}</div>}
  </section>;
}
