# Clear Writing operations runbook

This runbook is local preparation, not proof that production operations are configured.

## Health and deploy

- Render health check: `/healthz/`. It returns 200 only when the API can run `SELECT 1` against its configured database; database errors return 503 and are logged without connection details.
- Production refuses to start without PostgreSQL `DATABASE_URL`; it cannot silently use the local SQLite file.
- Keep accounts and billing disabled until production credentials, backups, email, monitoring, privacy review, and end-to-end tests are ready.
- After a deploy, record the revision, health result, migration result, and synthetic signup/rewrite/billing checks. Roll back to the last known-good revision if migrations or the synthetic journey fail.

## PostgreSQL backup and restore

1. Configure the hosting provider's scheduled PostgreSQL backups, retention, access control, and restore-point alerts. Do not treat this as complete until the selected account confirms these controls.
2. For a manual encrypted off-provider backup, obtain a short-lived database connection string through the hosting secret manager, pipe `pg_dump --format=custom` into the approved encryption tool, and upload only the encrypted artifact to the approved private backup store. Do not put credentials in command history or logs.
3. Record backup time, database identifier, artifact checksum, encryption/key owner, and retention expiry in the restricted operations log. Never include customer text.
4. Restore the artifact into an isolated, access-restricted PostgreSQL database with `pg_restore`; run Django migrations and smoke tests there. Record duration and results. Do not overwrite production during a restore test.
5. Rehearse restoration after material schema changes and on the approved schedule; alert on missed backups and failed restores.

## Incident and email handling

- Check health, recent deployment/migration logs, database connectivity, and provider status; preserve only minimal diagnostic data.
- Disable account creation or billing using provider environment settings if they create risk; do not delete customer records to troubleshoot.
- Verification and password-reset messages are service emails. Optional onboarding is off by default and sent once only after explicit opt-in. No prospect or marketing campaigns are configured.
- Investigate email delivery failures through provider logs; never log message bodies, auth tokens, passwords, or API secrets.

## Still requires owner setup

See EatItAll `01_Command_Center/OWNER_INPUTS_REQUIRED.md`. Backups, alert delivery, restore proof, and production rollback remain unverified until configured in the owner's personal accounts.
