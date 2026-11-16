# Clear Writing

**A calmer workspace for finding the right words.** Rewrite a professional draft or summarise a longer note, then review, share or copy, download, or continue editing the result.

- **Live app:** <https://clear-writing-studio.onrender.com/>
- **Backend health:** <https://ai-writing-assistant-xfbr.onrender.com/healthz/>

## Data and usage notice

This prototype is for adults (18+) and professional use. Text submitted to the app is sent to Google Gemini. Avoid sensitive, confidential, or personal information. Google’s data-use terms differ between unpaid and paid API usage; unpaid service content may be used to improve Google products and may be reviewed by people. Read the [Gemini API terms](https://ai.google.dev/gemini-api/terms) before handling user content.

The API has optional email/password accounts, email verification, password recovery, workspace-scoped voice settings, team invitations, member controls, ownership transfer, and self-serve account deletion. A test-mode Stripe checkout, billing portal, and signed webhook integration are implemented locally; the live demo keeps accounts and billing disabled. Production accounts require PostgreSQL, verified SMTP settings, monitoring, reviewed legal/privacy details, and explicit backend/frontend enable flags. This worktree has not been deployed or tested against a Stripe account, so it is not ready for paid customer accounts. The anonymous API limit is a basic abuse guard, not a commercial billing system.

Each signed-in free workspace is capped at 100 successful AI requests per UTC calendar month by default (`FREE_MONTHLY_REQUEST_LIMIT`); a matching active/trialing Team subscription can raise that to 300 (`TEAM_MONTHLY_REQUEST_LIMIT`). Free workspaces allow 3 seats and Team workspaces 5 by default. Usage limits protect provider spend; temporary failures, invalid provider responses, and empty results release the reserved use. Limits are configurable and are not a price or a promise of uninterrupted service.

## What it does

- Rewrite text while preserving its intent, or summarise the key points.
- Choose a clear, warm, direct, or formal output tone for either action.
- Add optional voice guidance and up to eight reusable phrases; anonymous settings stay in the current browser tab, while signed-in workspace settings can be saved in the configured database. Phrases enter an AI request only after you insert them into the draft.
- Create a password-protected workspace in local development; each new account must verify its email before signing in and gets a private workspace owner membership.
- Invite teammates by email with a seven-day, single-use link; only the invited, verified account can accept it. Invitation tokens are stored as hashes, and owners can revoke pending invitations.
- Let workspace owners review the team, remove members, and transfer ownership. Only owners can change shared voice guidance and reusable phrases; members can use those settings while writing.
- Switch between workspaces in a signed-in browser tab; workspace settings, member access, and AI usage are scoped to the selected workspace.
- Request a password reset by email; a successful reset revokes outstanding refresh tokens.
- Delete an account after confirming its email and password. Owners must transfer ownership or remove other team members first; other workspaces remain for their teams.
- Start from a sample draft, see word and character counts, and edit up to 5,000 characters.
- Keep the current draft in this browser tab across reloads; Clear draft removes the saved copy.
- Show whether the draft is saved in this tab and warn clearly when browser storage is unavailable.
- Review results in place, copy or download them, or use one as the next draft.
- Compare a rewrite or summary with the original draft, including the word-count change, before you use it.
- Restore the original draft after using a result as the next draft, including after a reload in the same tab; both drafts stay in session storage.
- Submit only after confirming you are 18+ and agreeing to send the draft and any voice guidance to Google Gemini.
- Show a clear retry message when the anonymous demo request limit is reached; the draft stays in the browser.
- Stop waiting after 45 seconds and keep the draft visible if the service does not respond in time.
- Keep provider API credentials on the backend; the browser receives only the service URL.
- Protect the static frontend with a restrictive Content Security Policy and cache hashed assets for a year.
- The local build includes a plain-language privacy notice at `/privacy.html`; it still needs operator contact details and a jurisdiction-specific review before commercial launch.
- Free, login-free tools run locally in the browser: [`/tools/clear-copy-check.html`](https://clear-writing-studio.onrender.com/tools/clear-copy-check.html) and [`/tools/email-tone-template.html`](https://clear-writing-studio.onrender.com/tools/email-tone-template.html). Optional email signup is hidden until the approved LeadHub HTTPS URL is configured.
- Practical guides: [clear client emails](https://clear-writing-studio.onrender.com/guides/write-clear-client-emails.html), [support replies](https://clear-writing-studio.onrender.com/guides/support-reply-template.html), and [meeting summaries](https://clear-writing-studio.onrender.com/guides/meeting-summary-template.html). Local revisions are not deployed.

## Stack

- Django REST Framework backend
- React + Vite frontend
- Google Gemini `generateContent` API

## Local setup

### Backend

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Generate a local Django key and add it to `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Keep `DJANGO_DEBUG=true` only for local development. Add a Gemini key to `GEMINI_API_KEY` to enable AI requests. Then run:

```bash
python manage.py migrate
python manage.py check
python manage.py test api
python manage.py collectstatic --noinput
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/api/rewrite/`; `/healthz/` reports supported modes, styles, and output formats. It accepts JSON with a `text` field (up to 5,000 characters), `mode` set to `rewrite` or `summarise`, optional `style` set to `clear`, `warm`, `direct`, or `formal`, and optional `format` set to `general`, `customer_email`, `internal_update`, or `meeting_recap`. The `customer_email` format creates text for you to review; it never sends email. All formats are instructed to preserve source facts and omit unsupported details. Anonymous requests use a best-effort 10-per-hour throttle; configure and verify trusted proxy IP handling before relying on it as abuse protection. The Gemini key stays on the backend and is sent in the `x-goog-api-key` header.

### Frontend

```bash
cd frontend
npm ci
npm test
npm run dev
```

Vite serves the app at `http://localhost:5173`. Set `VITE_API_URL` in `frontend/.env.local` if the backend uses another address. Only put public configuration in Vite variables; they are included in browser code.

Run frontend checks with:

```bash
npm run lint
npm run build
```

## Production and privacy

The browser sends text to the backend only after the user selects **Rewrite** or **Summarise** and confirms both consent checkboxes. The current draft is held in this tab's `sessionStorage` so it can survive a reload; **Clear draft** removes it. The server does not store submitted text and forwards it to Google Gemini. Google’s data-use terms differ between unpaid and paid API usage; on unpaid API usage, prompts and responses may be used to improve Google products and may be reviewed by people. Read the [Gemini API terms](https://ai.google.dev/gemini-api/terms) before sending work content. Never submit sensitive, confidential, or personal information.

The live frontend is a Render static site and the API is a separate Render web service. `render.yaml` documents both. Production settings:

- Set a unique `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, exact `DJANGO_ALLOWED_HOSTS`, and exact `CORS_ALLOWED_ORIGINS` values.
- The static site applies a same-origin script/style policy, limits API connections to the configured backend, and denies framing.
- Set the frontend's public `VITE_API_URL` to the HTTPS origin of the deployed API. It is compiled into browser code and must never contain a secret. Production builds do not fall back to localhost.
- Set `CORS_ALLOWED_ORIGINS` on the API to the exact HTTPS origin of the live frontend.
- Set `DATABASE_URL` to a managed PostgreSQL connection string before enabling accounts. SQLite remains the local-development fallback and is not suitable for durable production workspaces.
- Configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS=true`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, and HTTPS `PUBLIC_APP_URL` before enabling accounts.
- Keep `ENABLE_ACCOUNTS=false`, `VITE_ACCOUNTS_ENABLED=false`, and `ENABLE_BILLING=false` until a durable database, email delivery, Stripe webhook delivery, monitoring, support contact, and privacy/legal review are ready for the intended users.
- Billing is test-mode only: the backend refuses to enable it without a Stripe `sk_test_` key, webhook signing secret, configured `price_` ID, and HTTPS `PUBLIC_APP_URL`. Never substitute a live key; live-mode webhooks are rejected. The Team price is configured in Stripe and is not hard-coded in this repository.
- Serve over HTTPS. Set `SECURE_SSL_REDIRECT=true` only when the deployment is configured to serve HTTPS correctly. Enable HSTS after confirming the full domain and its subdomains use HTTPS.
- Use a paid Gemini API project for any service handling user content, and verify the terms and privacy requirements for the intended audience and region.
- Before public commercial use, configure billing and monitoring, and approve the privacy notice with the responsible business/contact and jurisdiction-specific requirements.
