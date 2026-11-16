# Draftloom feature roadmap

This roadmap was corrected after reading the current README and app/API flow. Clear Writing already has tone controls, shared workspace guidance and phrases, invites/roles, usage limits, draft persistence, comparison/restore, human review, copy/download, and account controls. Those are existing baseline features and are not counted as new work.

Impact/effort are estimates, not buyer evidence. Competitor gaps below summarize review themes in [`MARKET_RESEARCH.md`](MARKET_RESEARCH.md); they are not claims about every user. Do not start a feature unless target users confirm the problem and tests, accessible UI states, and help documentation ship with it.

| # | New feature | User problem solved | Competitor gap addressed | Impact | Effort |
|---:|---|---|---|---|---|
| 1 | Protected terminology glossary with exact-term checks | Prevents product names and approved phrases changing during rewrite | False flags for technical terms and proper names | High | Medium | **Implemented locally** — owner-managed workspace terms, anonymous session terms, API enforcement and regression tests; not deployed. |
| 2 | Structured context brief (reader, goal, must-keep facts, avoid list) | Reduces irrelevant drafts and meaning drift | Weak context understanding | High | Medium | **Implemented locally** — four bounded per-request fields, prompt scoping, validation and regression test; not deployed. |
| 3 | Change rationale view linked to each changed sentence | Lets a reviewer verify the rewrite quickly | Inaccurate or over-editing suggestions | High | Medium |
| 4 | Workspace style-guide versions with rollback | Keeps approved voice stable as guidance evolves | Generic or repetitive outputs | High | High |
| 5 | Approval handoff with reviewer, status, and comment | Gives small teams a traceable review step | No clear lightweight approval flow in single-editor workflows | High | High |
| 6 | Approved message-template library with variables | Removes repeated setup for common client replies | Repetitive output despite template/context gaps | High | Medium |
| 7 | User-controlled retention windows and workspace purge proof | Reduces risk from storing old drafts/settings | Trust and data-control concerns | High | Medium |
| 8 | Review-before-send sensitive-data detector/redaction | Helps prevent accidental disclosure to an AI provider | User needs clearer protection before processing | High | Medium |
| 9 | Workspace quality benchmark from owner-approved sample pairs | Shows whether a style change improves useful drafts | Users still manually judge correctness | High | High |
| 10 | Export to Markdown and DOCX with stable formatting | Avoids reformatting when moving work into existing tools | Workflow friction and output portability | Medium | Medium |
| 11 | Downloadable workspace usage and cost report | Helps an owner understand usage and provider spend | Cost visibility is absent from a request-count-only meter | Medium | Medium |
| 12 | Explicit offline state and safe retry queue | Prevents losing work during a network interruption | Cloud-only interruption | Medium | Medium |
| 13 | Batch review of multiple approved, non-sensitive drafts | Saves repeated setup for support/ops teams | Repetitive one-at-a-time workflow | Medium | High |
| 14 | Consent-based Google Docs export and Slack review link | Reduces manual copy/paste and review handoff | Limited workflow integration | Medium | High |
| 15 | Regional English/language variant control with glossary protection | Helps teams serve different locales without changing key terms | Language and context mismatch | Medium | High |

## Current delivery status

Feature 1 is implemented locally. Signed-in terms are workspace-scoped and editable only by the workspace owner; anonymous terms stay in the browser session. The API checks case and spelling preservation after generation and rejects a rewrite that drops a protected term. See `ARCHITECTURE.md` and the regression tests in `api/tests.py`.

Feature 2 is implemented locally. Reader, goal, facts-to-keep and avoid-list values are bounded, held only in page memory, and sent only with a user-confirmed AI request. The API rejects unknown/oversized fields and scopes the values as context data; facts still must be supported by the source. See the local screenshot and regression test in `api/tests.py`.

The two login-free SEO lead magnets are implemented in the app repo as separate pages: Clear Copy Check and Email Tone Planner. Their functions have unit tests and are listed in the sitemap. Optional LeadHub capture is present but hidden until a verified HTTPS LeadHub URL is configured and the privacy/sender setup is approved. They do not upload draft text.

Items 1–2 have local implementation and regression tests, but are not deployed or buyer-validated. Continue with item 3, then complete the first-time walkthrough and the remaining product, security, operations, legal and commercial gates before launch claims.
