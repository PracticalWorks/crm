# crm

**Typed tooling for the [Twenty](https://twenty.com) CRM.** A REST client your services and agents can call, the lead pipeline declared as a Twenty App, and typed events when a lead moves.

[![@practicalworks/crm on npm](https://img.shields.io/npm/v/@practicalworks/crm?label=%40practicalworks%2Fcrm)](https://www.npmjs.com/package/@practicalworks/crm)
[![ci](https://github.com/PracticalWorks/crm/actions/workflows/ci.yml/badge.svg)](https://github.com/PracticalWorks/crm/actions/workflows/ci.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)

Twenty is an open-source CRM with a good API. This repo is what we built so the rest of our software could use it as the one place relationship records live: an inbox that files a new contact, an app that opens an Opportunity when it finds a lead, an agent that looks a person up by phone number.

| Part | Use it when |
|---|---|
| [**`@practicalworks/crm`**](packages/client) | You want typed, tested calls for companies, people, notes, tasks and opportunities, behind one `CrmPort` interface you can fake in tests. It looks people up by email or phone the way an inbox needs, and stores North American phone numbers the way Twenty expects them. |
| [**`twenty-app/`**](twenty-app) | You want your pipeline's shape in code review, not hand-made in settings: custom objects and fields, select options and views, applied with Twenty's app tooling. It also sends `crm/opportunity.*` events to [Inngest](https://www.inngest.com) when a lead opens, moves or closes. |

## Quick start

```sh
npm install @practicalworks/crm
```

```ts
import { CrmClient } from "@practicalworks/crm";

const crm = new CrmClient({
  baseUrl: "https://crm.example.com",
  apiKey: process.env.TWENTY_API_KEY!,     // Settings → APIs & Webhooks in Twenty
});

const [person] = await crm.findPeople({ phone: "(813) 555-0142" });
const [company] = await crm.searchCompanies("Harbor");
```

The [package README](packages/client) covers every call, the types and the opportunity events.

## Trust

- **Provenance on every release.** Versions are published from this repo's `main` by GitHub Actions through npm trusted publishing, with no long-lived token. The job checks the registry's provenance attestation before it passes, and you can check it yourself with `npm audit signatures`.
- **Nothing private in the repo.** `pnpm guard` fails CI on credentials, instance hostnames, internal references or brand data.
- **The app is planned on every pull request and applied only by hand.** `.github/workflows/twenty-app.yml` runs `twenty app plan` on each PR. Applying needs a confirmed manual dispatch: stage options first, then `twenty app apply --no-prune`.

## Develop

```sh
pnpm install
pnpm guard && pnpm build && pnpm typecheck && pnpm test
```

To try the app against your own workspace (Node 24, with `TWENTY_API_URL` and `TWENTY_API_KEY` set): `node twenty-app/scripts/stage-options.ts` (a dry run), then `twenty app plan --path twenty-app --no-prune`.

To release, bump `packages/client/package.json` `version`; merging to `main` publishes it.

Issues and pull requests are welcome. Please open an issue before a large change. Report a vulnerability privately through [GitHub's security advisories](https://github.com/PracticalWorks/crm/security/advisories/new).

## Who makes this

[Practical Works](https://practical.works), a small software shop in Tampa Bay. Twenty is our CRM, and every app we run writes to it through this client, so we maintain it because we depend on it.

Questions, bug reports and ideas are welcome in [issues](https://github.com/PracticalWorks/crm/issues). And if you need a hand shipping an app or wiring your systems into a CRM, we [take on projects](https://practical.works).

MIT licensed.
