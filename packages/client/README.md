# @practicalworks/crm

A typed client for the [Twenty](https://twenty.com) CRM's REST API. One `CrmClient` covers companies, people, notes, tasks and opportunities, behind one `CrmPort` interface, and persists nothing itself: Twenty stays the one source of truth for relationship records.

```ts
import { CrmClient } from "@practicalworks/crm";

const crm = new CrmClient({ baseUrl: "https://your-twenty.example", apiKey: process.env.TWENTY_API_KEY! });
const [company] = await crm.searchCompanies("Harbor");
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
- **Notes:** written as `bodyV2.markdown` and linked to a company through `noteTargets`.
- **Tasks:**
  - `createTask` takes an optional `assigneeId`, which must be a Twenty **WorkspaceMember id**, not a Person id.
  - Tasks link to companies through Twenty's separate `taskTargets` join, so "a company's tasks" and "all tasks" are different queries.
- **Opportunities:** they attach directly to companies and carry a stage. `createOpportunity`, `listOpportunities` and `updateOpportunityStage` cover them.

## Types

`CrmPort` is the interface the client implements. `CrmCompanyRef`, `CrmPersonRef`, `CrmNoteRef`, `CrmTaskRef` and `CrmOpportunityRef` are zod schemas, each with its inferred type of the same name.

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
