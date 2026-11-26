# @practicalworks/crm

**A typed client for the [Twenty](https://twenty.com) CRM's REST API.** Companies, people,
notes, tasks and opportunities behind one `CrmPort` interface, so your services and agents
read and write the CRM the same way and your tests can fake it. It stores nothing itself:
Twenty stays the one source of truth for relationship records.

[![npm](https://img.shields.io/npm/v/@practicalworks/crm)](https://www.npmjs.com/package/@practicalworks/crm)
[![ci](https://github.com/PracticalWorks/crm/actions/workflows/ci.yml/badge.svg)](https://github.com/PracticalWorks/crm/actions/workflows/ci.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-blue)](https://github.com/PracticalWorks/crm/blob/main/LICENSE)

## Install

```sh
npm install @practicalworks/crm
```

## Quick start

Create an API key in Twenty (*Settings → APIs & Webhooks*), then:

```ts
import { CrmClient } from "@practicalworks/crm";

const crm = new CrmClient({ baseUrl: "https://crm.example.com", apiKey: process.env.TWENTY_API_KEY! });

const [company] = await crm.searchCompanies("Harbor");
const people = await crm.findPeople({ email: "sam@harbor.example" });   // who just emailed us?
```

The base URL is injected by the caller. The API key is a secret passed in at construction, never stored or logged here.

## What it does

- **Companies:** `searchCompanies` (case-insensitive substring), `getCompany` (with people), `createCompany`, and `findCompanyByDomain`. The domain lookup is an exact match on the primary domain after dropping scheme, `www.`, path and case on both sides; it returns null when nothing matches.
- **People by contact detail:** `findPeople({ email?, phone? })` resolves an inbound sender to People and their `companyId`.
  - Email is a case-insensitive exact match on the primary email. Additional emails are not searched.
  - Phone compares the last 10 digits of the primary phone and of every additional phone, so formatting and a `+1` do not matter.
- **Phones on write:** `createPerson` stores a North American number the way Twenty's PHONES field expects it: national digits and `+1` in their own fields, no country, so Twenty infers it. Any other number is kept as given.
- **Person lanes:** a Person may stand alone (`createPerson` without `companyId`) and carries a relationship `lane` (one of `PERSON_LANES`) and a free-text `source`.
  - `findPeople` returns `lane`, null for People written before the field existed.
  - Both are Twenty custom fields. Twenty stores a SELECT option in UPPER_SNAKE, so the client writes `CLIENT` and reads `client`.
  - Create the fields once per workspace, dry run by default: `pnpm --filter @practicalworks/crm exec tsx src/ensure-person-fields-cli.ts [--apply]` (env `TWENTY_API_KEY`, `TWENTY_BASE_URL`). It creates only what is missing, and refuses without writing a field that exists with the wrong type or a `lane` missing an option.
- **Notes:**
  - `addNote` writes the text as `bodyV2.markdown` and links it through `noteTargets` to a company (a bare company id, or `{ companyId }`) or to a person (`{ personId }`), so a contact with no company still gets its record.
  - `listNotes({ companyId })` or `listNotes({ personId })` reads them back through the same join, newest first, each with its `title`, markdown `body` (null when empty) and `createdAt`.
- **Tasks:**
  - `createTask` takes an optional `assigneeId`, which must be a Twenty **WorkspaceMember id**, not a Person id.
  - `createTask` takes an optional `body` in markdown, written as `bodyV2` like a note's. A task read back carries it as `body`: null when the task has none. A call without a body sends exactly what it did before.
  - Tasks link to companies through Twenty's separate `taskTargets` join, so "a company's tasks" and "all tasks" are different queries.
- **Workspace members:** `listWorkspaceMembers()` returns each teammate's WorkspaceMember `id`, `name` and login `email`. Those ids are what `assigneeId` and `ownerId` take, so a caller can assign by name.
- **Opportunities:** they attach directly to companies and carry a stage. `createOpportunity`, `listOpportunities` and `updateOpportunityStage` cover them.
- **Closing a lead:** `close(id, { outcome, scopingHours, closeDate? })` moves it to Closed. Since 0.17.0 `scopingHours` is required (0 when nobody scoped), and `close` throws before writing when Outcome or Scoping hours is missing, because the Twenty App's validation rules refuse a Closed lead without either.

## Types

`CrmPort` is the interface the client implements, with `LeadRecordPort`, `WorkspaceMemberPort` and `NotePort` beside it. `CrmNoteTarget` names a note's company or person. `CrmCompanyRef`, `CrmPersonRef`, `CrmNoteRef`, `CrmTaskRef`, `CrmOpportunityRef` and `CrmWorkspaceMemberRef` are zod schemas, each with its inferred type of the same name.

## Opportunity events

The Twenty App in this repo sends an event to Inngest whenever a lead moves. The names and payload types come from this package, so a listener imports the same contract the sender uses:

| Event | When | Extra data |
| --- | --- | --- |
| `crm/opportunity.opened` | an Opportunity is created | |
| `crm/opportunity.stage-changed` | its stage changes | `fromStage`, `toStage` |
| `crm/opportunity.closed` | it reaches Closed, or its outcome is set while Closed | `outcome` |
| `crm/opportunity.updated` | its Type or Step changes and the stage does not | |

Every event's `data` carries `opportunityId`, `actorId`, `brandId`, `type`, `stage`, `ownerId`, `before`, `after`, `diff` and `updatedFields`. Its `id` is `<opportunity>:<event>:<updatedAt>`, so Inngest drops a resent duplicate.

```ts
import { OPPORTUNITY_EVENTS, type OpportunityStageChangedData } from "@practicalworks/crm";

inngest.createFunction({ id: "on-lead-moved" }, { event: OPPORTUNITY_EVENTS.STAGE_CHANGED }, async ({ event }) => {
  const { fromStage, toStage } = event.data as OpportunityStageChangedData;
});
```

`opportunityEvents(change)` is the pure function behind it: give it a created or updated record and it returns the events to send.

## Who makes this

[Practical Works](https://practical.works), a small software shop in Tampa Bay. Every app we run writes to Twenty through this client. Issues and ideas are welcome on [GitHub](https://github.com/PracticalWorks/crm/issues), and if you need a hand wiring your systems into a CRM, we [take on projects](https://practical.works).

MIT licensed.
