# Security policy

## Supported releases

Only the latest code on the default branch is currently supported. No production service-level response time is promised.

## Report a vulnerability

Do not post credentials, customer drafts, or exploit details in a public issue. Use the repository's **Security** tab and **Report a vulnerability** private advisory flow when enabled. If private vulnerability reporting is unavailable, do not publish sensitive exploit details; ask the repository owner to enable it before sharing a report.

Include the affected component, impact, minimal reproduction steps, and a safe contact route. Do not include real user data or secrets. The project currently has no dedicated security-response inbox or published response SLA.

## Scope notes

The free writing tools process text in the browser. The main studio sends a draft to the configured backend and Google Gemini only after the user confirms. Never test against another user's workspace or submit sensitive production data.
