# Local Stratdeck setup

Supported runtime is Node.js 24. Run `npm ci`, `npm run build`, then `npm run start:fixture` and open `http://127.0.0.1:4179`. The offline fixture uses synthetic content, a disposable temporary database/media directory, and a fixture-only test password; it does not load `.env` or connect to Discord. Never use fixture credentials with real content.

## Configure a private instance

1. Copy `.env.example` to `.env` and set the guild ID, optional excluded channel IDs, bot token, and a random session secret (`openssl rand -hex 32`). Keep `.env` private and never commit or disclose its contents.
2. Put included category IDs in versioned `config/categories.txt`, one numeric Discord snowflake per line. `#` comments and blank lines are allowed. The checked-in IDs are owner-selected public Discord category identifiers. The application ignores deprecated `DISCORD_INCLUDED_CATEGORY_IDS`; missing, empty, or malformed category files stop startup rather than broadening scope.
3. Create a Discord bot for the intended server. Enable Guilds, Guild Messages, and Message Content intents as needed. Invite with only View Channel and Read Message History for selected channels; do not grant Administrator. Discord's approval requirements may differ for verified or large bots.
4. Set a strong shared login password privately using `npm run password` in an interactive terminal. Input is hidden; the tool writes a scrypt hash and increments the password version in `./data/password.json` without printing the value. Rotating the password invalidates existing sessions.
5. Run `npm run dev` and visit `http://127.0.0.1:4178`. The default listener is loopback-only. Do not expose a public listener without HTTPS termination and `NODE_ENV=production`.

Category changes are code/config changes: review and commit `config/categories.txt`, build and deploy, then startup reconciliation applies the changed scope. Do not copy category IDs from secrets or server exports. Other configuration stays in private `.env`.

## Data, backups, and checks

SQLite, downloaded media, and password hash live under private `./data/`; keep them out of Git and public web roots. Back up the database and matching `data/media/` together after stopping the service. Backups/exports contain private strategy content. Exports are validated with `npm run validate-export -- PATH`; never publish exports publicly. CDN URLs are transient and are not stored in exports/API results.

- `npm test` — unit/integration tests with synthetic fixtures.
- `npm run typecheck` — TypeScript check.
- `npm run lint` — ESLint.
- `npm run build` — backend compile and frontend build.
- `bash skills/strategy-playbook/scripts/verify.sh` — canonical skill fixture checks.

See [DEPLOYMENT.md](DEPLOYMENT.md) for VPS setup, TLS limitations, CI secrets, and recovery. No live Discord connection is required for ordinary local validation.
