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
