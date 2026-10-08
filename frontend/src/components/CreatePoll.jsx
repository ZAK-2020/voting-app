import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api, formatDate } from "../api";
import HiddenResults from "./HiddenResults";

export default function CreatePoll() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [draftId, setDraftId] = useState(id || null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState(!!location.state?.preview);
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState("");
  const [dirty, setDirty] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [closesAt, setClosesAt] = useState("");
  const [resultsVisibility, setResultsVisibility] = useState("always");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    setLoading(true); setLoadError("");
    let active = true;
    api("/api/drafts/" + id).then(data => {
      if (!active) return;
      setDraftId(data._id); setVersion(data.version); setQuestion(data.question);
      setOptions(data.options); setResultsVisibility(data.resultsVisibility);
      const date = data.closesAt ? new Date(data.closesAt) : null;
      setClosesAt(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
      setLocked(data.state === "publishing");
      if (data.state === "publishing") setPreview(true);
      setLoading(false);
    }).catch(error => { if (active) { setLoadError(error.message); setLoading(false); } });
    return () => { active = false; };
  }, [id, reload]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const body = () => ({ question, options, resultsVisibility, closesAt: closesAt ? new Date(closesAt).toISOString() : null });
  async function save(forPreview = false) {
    if (submitting) return;
    setSubmitting(true); setError(""); setSaved("");
    try {
      const data = await api(draftId ? "/api/drafts/" + draftId : "/api/drafts", { method: draftId ? "PUT" : "POST", body: { ...body(), version } });
      setDraftId(data._id); setVersion(data.version); setDirty(false); setSaved("Draft saved. Only you can see it.");
      if (!id) navigate("/drafts/" + data._id + "/edit", { replace: true, state: { preview: forPreview } });
      else setPreview(forPreview);
    } catch (error) { setError(error.message); } finally { setSubmitting(false); }
  }
  async function submit(event) {
    event.preventDefault();
    const labels = options.map(value => value.trim().toLowerCase());
    if (!question.trim() || labels.some(value => !value) || new Set(labels).size !== labels.length) { setError("Complete the question and add at least two different, non-empty options before previewing."); return; }
    if (closesAt && new Date(closesAt) <= new Date()) { setError("Choose a closing time in the future before previewing."); return; }
    await save(true);
  }
  async function publish() {
    if (submitting) return;
    setSubmitting(true); setError("");
    try {
      const data = await api("/api/drafts/" + draftId + "/publish", { method: "POST", body: { version } });
      setDirty(false);
      navigate("/polls/" + data.pollId, { replace: true, state: { created: true } });
    } catch (error) { setError(error.message); } finally { setSubmitting(false); }
  }
  if (loading || loadError) return <div className="narrow-page"><Link className="back-link" to="/drafts">← My drafts</Link><p className="page-message" role={loadError ? "alert" : "status"}>{loadError || "Loading draft…"}</p>{loadError && <button className="button secondary" onClick={() => setReload(value => value + 1)}>Try again</button>}</div>;
  if (preview) return <div className="narrow-page">
    <div className="page-heading compact"><span className="eyebrow">Private preview · Not published</span><h1>Ready for your people?</h1><p>This is how the ballot will look. Preview selections do not cast a vote.</p></div>
    <article className="surface ballot preview-ballot"><span className="badge draft">Preview</span><h1>{question}</h1><p className="poll-meta">{closesAt ? "Closes " + formatDate(closesAt) : "No closing date"}</p>
      {resultsVisibility !== "always" && <HiddenResults poll={{ resultsVisibility }} />}
      <fieldset className="choices"><legend>Choose one option</legend>{options.map((option, index) => <label className="choice" key={index}><input type="radio" name="preview-choice" /><span>{option}</span></label>)}</fieldset>
      <button className="button primary full-width" disabled>Submit vote (preview only)</button>
      <p className="ballot-hint">Sign-in required · One vote per account per poll</p>
      <p className="form-note">{resultsVisibility === "always" ? "Results are visible to everyone from the start." : resultsVisibility === "after_vote" ? "Results unlock after voting and become public after closing." : "Results stay hidden from everyone until the poll closes."}</p>
    </article>
    {error && <p className="error-message" role="alert">{error}</p>}
    {locked && <p className="form-note">Publishing was started earlier. Retry to finish publishing this saved version.</p>}
    <div className="form-actions editor-actions"><button className="button secondary" disabled={submitting || locked} onClick={() => setPreview(false)}>Back to editing</button><button className="button primary" disabled={submitting} onClick={publish}>{submitting ? "Publishing…" : "Publish poll"}</button></div>
    <p className="field-hint">Publishing makes the question and options public. You cannot edit them or the results setting afterward.</p>
  </div>;
  return (
    <div className="narrow-page">
      <Link className="back-link" to="/drafts">
        ← My drafts
      </Link>
      <div className="page-heading compact">
        <span className="eyebrow">Make room for every voice</span>
        <h1>{draftId ? "Edit your draft." : "Create a poll."}</h1>
        <p>A clear question is all it takes to get started.</p>
      </div>
      <form className="surface create-form" onSubmit={submit} onChange={() => { setDirty(true); setSaved(""); }}>
        <fieldset disabled={submitting}>
          <div className="form-group">
            <label htmlFor="question">What would you like to ask?</label>
            <input
              autoFocus
              id="question"
              maxLength={180}
              required
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. Where should we go for our team outing?"
            />
            <span className="field-hint">Keep it short and specific.</span>
          </div>
          <div className="form-group">
            <span className="field-label" id="options-label">
              Answer options
            </span>
            <div
              className="option-inputs"
              role="group"
              aria-labelledby="options-label"
            >
              {options.map((option, index) => (
                <div className="option-input" key={index}>
                  <span className="option-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <label className="sr-only" htmlFor={"option-" + index}>
                    Option {index + 1}
                  </label>
                  <input
                    id={"option-" + index}
                    maxLength={100}
                    required
                    value={option}
                    onChange={(event) =>
                      setOptions(
                        options.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      )
                    }
                    placeholder={"Option " + (index + 1)}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    disabled={options.length <= 2}
                    aria-label={"Remove option " + (index + 1)}
                    onClick={() => {
                      setOptions(options.filter((_, i) => i !== index));
                      setDirty(true); setSaved("");
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                className="text-button add-option"
                type="button"
                onClick={() => { setOptions([...options, ""]); setDirty(true); setSaved(""); }}
              >
                + Add another option
              </button>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="deadline">
              Closing date <span className="muted optional">Optional</span>
            </label>
            <input
              id="deadline"
              type="datetime-local"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
            />
            <span className="field-hint">
              In your local time. Leave blank to close the poll yourself.
            </span>
          </div>
          <fieldset className="visibility-options">
            <legend>When should results be visible?</legend>
            {[
              ["always", "Always visible", "Anyone can see results while voting is open."],
              ["after_vote", "After voting", "Voters see results after submitting. Everyone sees them once the poll closes."],
              ["after_close", "After closing", "Results stay hidden from everyone, including you, until voting ends."],
            ].map(([value, label, description]) => <label className={"visibility-choice " + (resultsVisibility === value ? "selected" : "")} key={value}><input type="radio" name="resultsVisibility" value={value} checked={resultsVisibility === value} onChange={() => setResultsVisibility(value)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}
            <p className="field-hint">Response totals stay public. Presentation mode reveals restricted results only after closing.</p>
          </fieldset>
          <div className="form-note">Drafts are private. Save your progress at any time, then preview and publish when ready.</div>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          {saved && <p className="success-message" role="status">{saved}</p>}
          {dirty && <p className="field-hint" role="status">You have unsaved changes. Save your draft before leaving this page.</p>}
          <div className="form-actions editor-actions">
            <button className="button secondary" type="button" disabled={submitting} onClick={() => save(false)}>Save draft</button>
            <button className="button primary" disabled={submitting}>
              {submitting ? "Saving…" : "Preview poll →"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
