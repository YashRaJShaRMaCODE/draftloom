import { useState } from "react";
import { MAX_BATCH_DRAFTS, prepareBatchDrafts } from "../utils/batchReview.js";

export function BatchReviewPanel({ allowed, busy, results, onRun, onCancel }) {
  const [drafts, setDrafts] = useState(["", ""]);
  const [attempted, setAttempted] = useState(false);
  const validation = prepareBatchDrafts(drafts);

  const start = () => {
    setAttempted(true);
    if (!validation.error) onRun(validation.drafts);
  };

  return (
    <details className="batch-review">
      <summary>Review several drafts at once <span>Up to {MAX_BATCH_DRAFTS}, processed one at a time</span></summary>
      <p className="batch-intro">Use approved, non-sensitive text only. Drafts stay in this tab and are sent one by one after you confirm processing below. This uses the selected tone and format; team voice, context, and protected terms are not attached.</p>
      <div className="batch-drafts">
        {drafts.map((draft, index) => (
          <div className="batch-draft" key={index}>
            <label className="field-label" htmlFor={`batch-draft-${index}`}>Draft {index + 1}</label>
            <textarea
              id={`batch-draft-${index}`}
              value={draft}
              maxLength={5000}
              disabled={busy}
              placeholder="Paste an approved, non-sensitive draft…"
              onChange={(event) => setDrafts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
              aria-describedby={`batch-count-${index}`}
            />
            <div className="editor-meta"><span id={`batch-count-${index}`}>{[...draft].length.toLocaleString()} / 5,000 characters</span>
              {drafts.length > 2 && <button className="quiet-button batch-remove" type="button" disabled={busy} onClick={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove draft {index + 1}</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="batch-controls">
        <button className="quiet-button" type="button" disabled={busy || drafts.length >= MAX_BATCH_DRAFTS} onClick={() => setDrafts((current) => [...current, ""])}>Add another draft</button>
        {!busy
          ? <button className="primary-button" type="button" disabled={!allowed || !drafts.some((draft) => draft.trim())} onClick={start}>Review drafts</button>
          : <button className="quiet-button" type="button" onClick={onCancel}>Stop batch</button>}
      </div>
      {!allowed && <p className="batch-help">Confirm you’re 18 or older and agree to send these drafts to Google Gemini below before starting.</p>}
      {attempted && validation.error && <p className="error-message" role="alert">{validation.error}</p>}
      <div className="batch-results" aria-live="polite">
        {results.map((item, index) => (
          <details className="batch-result" key={item.id}>
            <summary>Draft {index + 1} <span className={`batch-status is-${item.status}`}>{item.statusLabel}</span></summary>
            {item.error && <p className="error-message" role="alert">{item.error}</p>}
            {item.result && <><label className="field-label" htmlFor={`batch-result-${item.id}`}>Review result before sharing</label><textarea id={`batch-result-${item.id}`} readOnly value={item.result} /><button className="quiet-button" type="button" onClick={async (event) => {
              try { await navigator.clipboard.writeText(item.result); event.currentTarget.textContent = "Copied"; }
              catch { event.currentTarget.textContent = "Select and copy the text"; }
            }}>Copy result</button></>}
          </details>
        ))}
      </div>
    </details>
  );
}
