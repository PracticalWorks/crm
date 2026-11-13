# crm

Everything we run on the [Twenty](https://twenty.com) CRM, in one place to review.

| Path | What |
|---|---|
| `packages/client` | `@practicalworks/crm`: a typed client for Twenty's REST API (companies, people, notes, tasks, opportunities) behind one `CrmPort` |
| `twenty-app/` | A Twenty App: the lead record declared as code. The Brand object, the lead fields on Opportunity and the pipeline views; `scripts/stage-options.ts` for the standard stage field, which no app can own |

Nothing private lives here: no credentials, no instance hostnames, no internal ticket references, no brand data. Those are injected at run time. `pnpm guard` enforces it in CI.

```sh
pnpm install
pnpm guard && pnpm build && pnpm typecheck && pnpm test
```

The app is planned on every pull request (`.github/workflows/twenty-app.yml`) and applied only by a confirmed manual dispatch: stage options first, then `twenty app apply --no-prune`. Locally, with `TWENTY_API_URL` and `TWENTY_API_KEY` set and Node 24: `node twenty-app/scripts/stage-options.ts` (dry run) and `twenty app plan --path twenty-app --no-prune`.

Releases: bump `packages/client/package.json` `version`; merging to `main` publishes it to npm with provenance (`.github/workflows/publish.yml`).

MIT licensed.
