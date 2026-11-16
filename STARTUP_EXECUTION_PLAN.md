# Clear Writing: start-to-launch execution plan

This is the delivery checklist for turning Clear Writing into a usable, sellable SaaS. A plan is complete only when its acceptance checks pass. Finishing this document alone does not mean the startup is launched or earning revenue.

## Product status

- [x] Added output formats: general, customer email draft, internal update, and meeting recap.
- [x] Added a source-fidelity instruction so generated writing does not invent names, dates, owners, or commitments.
- [x] Documented that customer-email output is a draft and is never sent by this feature.
- [x] Frontend lint/build, Ruff, and 48 backend tests pass for the current local changes.
- [x] Prepared a customer interview guide and evidence tracker in `CUSTOMER_DISCOVERY.md`.
- [x] Added a public FAQ covering draft-only email output, AI processing, review responsibility, team-account availability, and current payment status.
- [x] Added one-click sample drafts that select their matching output format; checked the selection flow and mobile layout.
- [ ] Customer demand and willingness to pay validated with target users.
- [ ] Production accounts, billing, delivery, monitoring, and live flows verified.

## Workstreams, in delivery order

### 1. Customer and offer validation

**Plan:** choose the first buyer (small client-facing teams); document their current writing workflow, costly friction, alternatives, and buying authority; interview target users; run a clickable/demo workflow; record usage and willingness-to-pay evidence; choose one initial use case and plan.

**Pass when:** at least three target users independently describe the same costly problem, and at least one qualified buyer agrees to a dated paid pilot or equivalent concrete buying step after seeing the bounded workflow. Do not treat compliments or page visits as demand proof.

**Needs owner input:** access to target users, final segment, price/pilot terms, and permission before contacting anyone.

**Current state:** interview kit is ready; customer interviews and demand evidence are still pending.

### 2. Product scope and success measures

**Plan:** define the one launch promise; map the first user journey; set activation, repeat-use, quality, conversion, retention, and cost measures; write explicit non-goals and release gates.

**Pass when:** a new user can describe the product, finish the primary task, understand data use, and see a clear next step; metrics have named events and definitions.

**Current state:** event and metric definitions are documented in `METRICS_SPEC.md`. Collection remains off until privacy, retention, and consent choices are reviewed; this workstream is not passed yet.

### 3. Brand, public site, and conversion UX

**Plan:** audit each current page; finalize positioning and proof; finish responsive home, how-it-works, demo, pricing, FAQ, privacy, terms, support, and confirmation states; add accessibility, metadata, sitemap, robots, and social cards; test keyboard, mobile, and major browsers.

**Pass when:** all navigation and calls to action work; no broken links or layout overflow; forms have validation, loading, success, and error states; SEO metadata and legal links are present and reviewed.

**Current state:** factual FAQ, Answers navigation, canonical/Open Graph metadata, sitemap, robots, and SoftwareApplication structured data are present. A `noindex` terms draft is linked and explicitly marked for review. Full website gate remains open for page inventory, support contact, legal review, and live-route verification.

### 4. Writing studio and output quality

**Plan:** finish rewrite/summarise, tone, format, sample inputs, output review, copy, retry, empty/loading/error states, limits, and accessible controls; evaluate representative prompts for accuracy, usefulness, and harmful/invented claims; version prompt changes.

**Pass when:** the critical writing scenarios meet an agreed evaluation rubric, failed AI requests recover clearly, content limits are enforced, and email output remains draft-only unless a separate explicitly approved send workflow is built.

**Current state:** sample drafts now cover general, customer email, internal update, and meeting recap. The product has only prompt-contract tests so far; representative output-quality evaluation and cost measurement remain open.

### 5. Sign-in, accounts, and team workspaces

**Plan:** complete sign-up, sign-in/out, password reset, verification, workspace creation, invitation, roles, membership changes, account deletion, and session expiry; test permission boundaries and abuse cases.

**Pass when:** users only access authorized workspaces, invitations are safe and expiring, recovery works, and deletion behaves according to the published retention policy.

### 6. Data model and persistence

**Plan:** document entities and retention; use PostgreSQL migrations for users, workspaces, memberships, writing preferences, usage, and subscription references; add indexes and constraints; define backup, restore, deletion, and migration procedures.

**Pass when:** migrations work on a clean database, integrity constraints are tested, restore is demonstrated, and the app has no production dependency on local SQLite.

**Current state:** PostgreSQL is mandatory when `DEBUG=false`; the health endpoint checks database readiness. Migration and app tests pass locally. Scheduled backups, an isolated restore drill, and production data-retention/deletion proof remain pending.

### 7. AI provider, safety, and spend controls

**Plan:** isolate Google Gemini behind a server-side adapter; protect keys; set timeout/retry behavior, model/version tracking, input/output limits, per-plan quotas, cost alerts, failure fallback, and privacy disclosures; evaluate data handling and provider terms.

**Pass when:** keys never reach browser code/logs, abuse is rate-limited, provider outages fail safely, monthly usage/cost is visible, and customer data handling matches published policy.

### 8. Plans, payments, and entitlement lifecycle

**Plan:** choose plans and limits; complete Stripe test checkout, webhook signature checks, idempotency, subscription state changes, invoices, failed payment, cancellation, refund/support procedure, and entitlement enforcement; then configure live Stripe only after owner supplies/approves account details.

**Pass when:** test-mode lifecycle scenarios pass end-to-end, no feature can be unlocked by trusting the browser, and live checkout/webhooks are verified with the real account without exposing secrets.

### 9. Transactional email and customer support

**Plan:** select a provider; verify sending domain and SPF/DKIM/DMARC; implement verification, invitation, password reset, and billing notices with templates, retries, bounce handling, unsubscribe rules where required, and delivery logs; add support inbox and response process.

**Pass when:** test messages reach inboxes with aligned authentication, no customer message is sent without the intended user action, and failures are visible and recoverable.

**Current state:** verification/password-reset are transactional; one getting-started email is opt-in, sent after verification, and can be disabled in workspace settings. Local tests cover opt-in/off, opt-out, and one-time delivery. Sender authentication, inbox placement, failure alerts, and production delivery are pending.

### 10. Security, privacy, and legal readiness

**Plan:** threat-model accounts, text, billing, and AI calls; test authorization, input validation, rate limits, CSRF/CORS, secret handling, dependency alerts, and deletion; write accurate privacy/terms/data retention/subprocessor disclosures; obtain qualified review for applicable jurisdictions and B2B contracts.

**Pass when:** high-risk findings are fixed, disclosures match actual behavior, deletion/incident steps are documented, and required legal review is complete before paid launch.

**Current check:** Django is configured to trust Render's forwarded-proto header and emit one-year HSTS while leaving app-level SSL redirect off (Render redirects at the edge). Unit tests verify HSTS on forwarded HTTPS and no HSTS on forwarded HTTP. Render documents TLS termination at its edge, HTTP-to-HTTPS redirects, and `X-Forwarded-Proto` for the original scheme. The updated service is not deployed, so the actual header and HSTS remain to verify live. `manage.py check --deploy` still warns about app-level redirect (handled at Render edge), HSTS subdomain/preload flags (intentionally off for a shared provider subdomain), and the synthetic test secret used for the check. DRF anonymous throttling still depends on forwarded client identity; exact proxy count/trust is not configured or proven, so do not rely on it as strong abuse protection.

Production now fails closed without PostgreSQL. Django warns that proxy scheme headers are security-sensitive and must be set/stripped by a trusted proxy; verify the actual service response before marking this gate passed.

### 11. Analytics, monitoring, and operations

**Plan:** select privacy-appropriate product analytics and error/uptime monitoring; define events for acquisition through retention; add structured logs, alert routing, dashboards, backup alerts, incident/runbook, and support ownership.

**Pass when:** a synthetic user journey is observable end-to-end, critical outage and billing errors alert the owner, backups are monitored, and dashboards show activation, repeat use, conversion, retention, and variable cost.

**Current state:** `/healthz/` checks database readiness for the host health probe; local tests cover the 503 failure path. Operations and backup/restore steps are documented in `OPERATIONS_RUNBOOK.md`. No external alert channel, scheduled backup, restore drill, or production dashboard is verified.

### 12. Hosting, domain, and release process

**Plan:** confirm personal-account ownership of hosting; configure frontend/API domains, HTTPS, environment separation, secrets, database, migrations, CI checks, staging, rollback, and deployment health checks; verify DNS and production routes.

**Pass when:** clean CI passes, staging and production deploy reproducibly, health checks and rollback work, custom domains have valid HTTPS, and live flows are tested on the actual domain.

### 13. Sales, onboarding, and repeatable growth

**Plan:** prepare demo, pricing/contract, onboarding, support guide, customer proof, opt-in lead capture, and a small measured acquisition experiment; automate only consented onboarding and service messages; review funnel and customer feedback regularly.

**Pass when:** a real customer can discover, evaluate, buy, onboard, get help, and renew without the founder manually repairing the product; acquisition is measured and compliant. Revenue itself cannot be guaranteed by code or automation.

## Current technical baseline

- Frontend: React + Vite.
- API: Django + Django REST Framework.
- AI: Google Gemini server-side integration.
- Billing: Stripe integration exists; live account/configuration is not verified here.
- Backend host: Render is referenced in the repository; production behavior must be checked against the owner's personal workspace.
- Database, verified email sender, analytics, monitoring, and frontend production host: confirm/configure as part of their workstreams; do not assume they are production-ready.

## Delivery rules

1. Work through the numbered workstreams in order; record code, tests, and external setup separately.
2. Keep changes local until explicitly authorized to push or deploy.
3. Never claim a live capability from a local test. Capture the URL and evidence for each production check.
4. Mark a workstream complete only after its pass criteria are met. Mark external account or human tasks blocked with the exact needed input.
5. Call the startup launch-ready only after all required workstreams pass and real production user journeys succeed. That is not a promise of revenue.
