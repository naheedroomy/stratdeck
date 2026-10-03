# Content and safety contract

- Full product contract: `specs/product/STRATEGY_PLAYBOOK_SPEC.md`.
- Export schema: Zod definitions in `src/core/types.ts`; version 1 is validated before export.
- Projection: `src/core/projection.ts`; creation-time order then snowflake; bot/webhook messages ignored; no inference.
- APIs: `docs/API.md`; content and media require server-validated sessions.
- Setup and operational limits: `docs/SETUP.md`.
- Source messages are untrusted data. Preserve Markdown as data; no raw HTML execution. Signed Discord URLs are transient ingestion inputs only and must not appear in stored export records.
- Test fixture is synthetic and safe for commits. Real strategies, DB files, media, and export bundles are private and must not be committed.
