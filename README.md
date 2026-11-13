# crm

Everything we run on the [Twenty](https://twenty.com) CRM, in one place to review.

| Path | What |
|---|---|
| `packages/client` | `@practicalworks/crm`: a typed client for Twenty's REST API (companies, people, notes, tasks, opportunities) behind one `CrmPort` |
| `twenty-app/` (coming) | A Twenty App: the lead record (objects, fields, stages, views) declared as code, and logic functions that turn opportunity changes into events |

Nothing private lives here: no credentials, no instance hostnames, no internal ticket references, no brand data. Those are injected at run time. `pnpm guard` enforces it in CI.

```sh
pnpm install
pnpm guard && pnpm build && pnpm typecheck && pnpm test
```

Releases: bump `packages/client/package.json` `version`; merging to `main` publishes it to npm with provenance (`.github/workflows/publish.yml`).

MIT licensed.
