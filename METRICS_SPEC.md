# Clear Writing: product metrics specification

This defines what to measure before adding analytics code. No new analytics events are being collected by this document.

## North-star outcome

**Weekly teams that complete at least one successful writing task and return the next week.** This is a product-use signal, not proof of customer value or revenue.

## Funnel events

| Event | Meaning | Allowed properties |
|---|---|---|
| `studio_opened` | User intentionally enters the writing studio | `source_page` from a fixed allowlist; anonymous/session scope only if privacy notice allows |
| `account_created` | A verified account/workspace is created | internal workspace ID; date; no email in analytics |
| `first_task_succeeded` | First rewrite or summary succeeds | `mode`, `format`, `style`, input/output length buckets; no source text or result text |
| `task_succeeded` | Rewrite or summary succeeds | `mode`, `format`, `style`, length buckets; internal workspace ID only for first-party aggregate reporting |
| `task_failed` | A task fails before a usable result | coarse failure category; no prompt, response, email, or raw exception |
| `team_invite_accepted` | Invited teammate joins a workspace | internal workspace ID; no invited email in analytics |
| `checkout_completed` | A subscription is confirmed by a verified Stripe webhook | plan/price ID, currency, amount, date, internal workspace ID; never trust browser success alone |
| `subscription_cancelled` | Verified subscription cancellation is recorded | plan ID and date; cancellation reason only if explicitly supplied and reviewed |

## Metric definitions

- **Activation:** verified workspace completes its first successful task within 7 days of account verification.
- **Repeat use:** an activated workspace has at least one successful task in a later calendar week.
- **Task success rate:** successful AI responses divided by valid AI attempts, excluding invalid requests and quota rejections.
- **Trial-to-paid conversion:** verified workspaces that start a paid subscription divided by eligible workspaces entering the trial/pilot cohort. Define the cohort before reporting.
- **Net collected revenue:** settled charges minus refunds and processor fees, with date/currency and receipt reference. Never count trials, invoices sent, or pipeline as revenue.
- **Variable cost per successful task:** AI and payment/email costs attributed to successful tasks divided by successful task count; use provider bills, not estimates presented as actuals.

## Privacy and rollout gates

1. Do not store or forward source drafts, generated results, email addresses, raw IPs, or raw exception text as product analytics.
2. Prefer first-party aggregate counts. Do not add third-party analytics until the privacy notice, retention window, user choice, and vendor terms are reviewed.
3. Define event retention and deletion behavior before instrumentation. Billing receipts and product analytics have different legal/operational retention needs.
4. Test that analytics failures never block writing, login, checkout, or cancellation.
5. Label all thresholds as hypotheses until customer interviews and actual cohorts support them.

## What is available now

The signed-in workspace currently exposes monthly AI request usage and plan limits. Funnel, repeat-use, and cost metrics above are not yet instrumented; Stripe live revenue is not verified.
