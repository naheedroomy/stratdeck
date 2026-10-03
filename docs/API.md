# Stratdeck API contract (v1)

All IDs/snowflakes are strings. All API responses and private media use `Cache-Control: private, no-store, max-age=0`; no token or attachment URL is returned. Browser requests are same-origin and cookies are HttpOnly. JSON errors use `{ "error": string }`.

## Endpoints

- `GET /healthz` — public liveness only: `{ "status": "ok" }`. No guild or sync details.
- `GET /` — public static application shell only. No strategy content is embedded in the HTML or public assets.
- `POST /api/session` — same-origin JSON `{ "password": string }`; success `200 { "authenticated": true, "expiresAt": ISODate }` plus `playbook_session` cookie; invalid login `401 { "error": "Unable to sign in. Check the password and try again." }`, throttled `429`, cross-origin `403`.
- `GET /api/session` — protected; `200 { "authenticated": true }`, otherwise `401`.
- `DELETE /api/session` — protected, same-origin; revokes current session and clears cookie (`204`).
- `GET /api/library` — protected: `{ "guildId": string|null, "categories": Category[], "strategies": StrategySummary[] }`; ordered categories and channel-position-ordered strategies.
- `GET /api/strategies/{channelId}` — protected full `Strategy`, `404` if absent or unavailable.
- `GET /api/media/{sha256}.{png|jpg|webp}` — protected original bytes; only if an available strategy currently references the image, otherwise `404`. Do not cache or proxy into public storage.
- `GET /api/search?q={term}` — protected case-insensitive search across category names, source names/titles, overview and walkthrough notes. Query text is trimmed and bounded to 200 characters. Returns `{ "results": StrategySummary[] }` for available strategies only.
- `GET /api/status` — protected `{ "lastSuccessfulReconciliation": ISODate|null, "lastSuccessfulSync": ISODate|null, "strategyCount": number }`. No secrets or detailed Discord errors.
- `GET /api/export` — protected versioned `PlaybookExport` JSON. Paths are relative `images/{sha256}.{png|jpg|webp}`; use `npm run export -- <private-output-dir>` for a bundle including binary images.

## Shared types

Canonical Zod types live in `src/core/types.ts`. The relevant TypeScript shape is:

```ts
export interface Category { id: string; name: string; position: number }
export interface StrategySummary {
  id: string; categoryId: string; position: number; sourceName: string; title: string;
  syncStatus: 'current'|'stale'; tags: ('attack'|'defense')[]; revision: string;
  overview: { messageId: string; markdown: string }[]; stepCount: number;
}
export type Strategy = {
  id: string; categoryId: string; position: number; sourceName: string; title: string;
  sourceUpdatedAt: string|null; syncStatus: 'current'|'stale'|'unavailable'; tags: ('attack'|'defense')[];
  overview: { messageId: string; markdown: string }[];
  steps: { id: string; messageIds: string[];
    notes: { messageId: string; markdown: string }[];
    images: { attachmentId: string; file: `images/${string}` }[] }[];
  sourceMessages: SourceMessage[]; revision: string; publishedAt: string;
  warnings: string[]; available: boolean;
};
export type PlaybookExport = {
  schemaVersion: 1; exportedAt: string; guild: {id:string;name:string};
  categories: Category[]; strategies: Strategy[];
};
```

`SourceMessage` retains original Markdown, timestamps, author/webhook identity, and ordered attachment metadata (filename, MIME, byte size, decoded pixel dimensions, content hash, and relative private storage key where downloaded). It deliberately omits expiring Discord attachment URLs. `Strategy.revision` is SHA-256 of deterministic source content and identity, not a signed CDN URL. An overview note or step note is provenance-linked by its message ID. A step ID is its initiating image-bearing message ID. Markdown must be treated as untrusted text and rendered without raw HTML.

The export Zod schema is strict about schema version, IDs, content hashes, and safe relative media paths. Do not add frontend-only inferred strategy fields to this contract. The shell has no private content. Frontend can import shared runtime types/schemas from `src/core/types.ts` or define compile-time API views that stay shape-identical.
