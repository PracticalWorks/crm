import { describe, expect, it } from "vitest";
import { CrmClient, PERSON_LANES } from "./client.js";

interface Call {
  url: string;
  method?: string;
  body?: any;
}

/** Records every request and answers with representative Twenty `{ data }` shapes. */
function makeFetch(calls: Call[], routes: (url: string, method?: string) => unknown = () => ({})) {
  return (async (url: string, init?: any) => {
    calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined });
    return { ok: true, status: 200, json: async () => routes(url, init?.method) };
  }) as unknown as typeof fetch;
}

const CONFIG = { baseUrl: "https://twenty.test", apiKey: "k" };

describe("CrmClient deep-link + base normalization", () => {
  it("builds the company deep-link off the root", () => {
    const client = new CrmClient(CONFIG, makeFetch([]));
    expect(client.companyUrl("comp_1")).toBe("https://twenty.test/object/company/comp_1");
  });

  it("normalizes a base that already includes /rest", () => {
    const client = new CrmClient({ baseUrl: "https://twenty.test/rest/", apiKey: "k" }, makeFetch([]));
    expect(client.companyUrl("comp_1")).toBe("https://twenty.test/object/company/comp_1");
  });
});

describe("CrmClient.searchCompanies", () => {
  it("filters by ilike substring, depth=1, and maps to refs with deep-links", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({
        data: { companies: [{ id: "comp_1", name: "Harbor Homes LLC", domainName: "harbor.com" }] },
      })),
    );
    const results = await client.searchCompanies("Harbor");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(
      "https://twenty.test/rest/companies?filter=name[ilike]:%25Harbor%25&depth=1&limit=20",
    );
    expect(results).toEqual([
      {
        id: "comp_1",
        name: "Harbor Homes LLC",
        domainName: "harbor.com",
        crmUrl: "https://twenty.test/object/company/comp_1",
        people: [],
      },
    ]);
  });
});

describe("CrmClient.getCompany", () => {
  it("reads one company with depth and extracts people from a plain array", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({
        data: {
          company: {
            id: "comp_1",
            name: "Harbor Homes LLC",
            domainName: { primaryLinkUrl: "https://harbor.com" },
            people: [
              { id: "p1", name: { firstName: "Jo", lastName: "Rivera" }, emails: { primaryEmail: "jo@harbor.example" } },
            ],
          },
        },
      })),
    );
    const company = await client.getCompany("comp_1");
    expect(calls[0].url).toBe("https://twenty.test/rest/companies/comp_1?depth=1");
    expect(company?.domainName).toBe("https://harbor.com");
    expect(company?.people).toEqual([
      { id: "p1", firstName: "Jo", lastName: "Rivera", email: "jo@harbor.example", phone: null },
    ]);
  });

  it("returns null when the record is absent", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], () => ({ data: { company: {} } })));
    expect(await client.getCompany("missing")).toBeNull();
  });
});

describe("CrmClient.createCompany", () => {
  it("posts the name and tolerates the create<Object> wrapper", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({ data: { createCompany: { id: "comp_new", name: "New Co" } } })),
    );
    const company = await client.createCompany({ name: "New Co" });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/companies", method: "POST", body: { name: "New Co" } });
    expect(company.id).toBe("comp_new");
    expect(company.crmUrl).toBe("https://twenty.test/object/company/comp_new");
  });
});

describe("CrmClient.createPerson", () => {
  it("nests the name and sends composite email/phone only when given", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({ data: { createPerson: { id: "p_new", name: { firstName: "Sam", lastName: "Lee" } } } })),
    );
    const person = await client.createPerson({ companyId: "comp_1", firstName: "Sam", lastName: "Lee", email: "sam@x.com" });
    expect(calls[0].body).toEqual({
      name: { firstName: "Sam", lastName: "Lee" },
      companyId: "comp_1",
      emails: { primaryEmail: "sam@x.com" },
    });
    expect(person.id).toBe("p_new");
  });
});

describe("CrmClient.createPerson phones", () => {
  it.each([
    ["4072125264", { primaryPhoneNumber: "4072125264", primaryPhoneCallingCode: "+1" }],
    ["(407) 212-5264", { primaryPhoneNumber: "4072125264", primaryPhoneCallingCode: "+1" }],
    ["+1 407 212 5264", { primaryPhoneNumber: "4072125264", primaryPhoneCallingCode: "+1" }],
    ["14072125264", { primaryPhoneNumber: "4072125264", primaryPhoneCallingCode: "+1" }],
    // +1 is not only the US: Twenty refuses a stamped "US" on these, so no country is sent.
    ["(787) 717-4922", { primaryPhoneNumber: "7877174922", primaryPhoneCallingCode: "+1" }],
    ["(236) 702-1095", { primaryPhoneNumber: "2367021095", primaryPhoneCallingCode: "+1" }],
    ["+44 20 7946 0958", { primaryPhoneNumber: "+44 20 7946 0958" }],
  ])("stores %s as Twenty's composite: national digits and calling code apart, the country left to Twenty", async (input, phones) => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { createPerson: { id: "p_new" } } })));
    await client.createPerson({ firstName: "Texter", phone: input });
    expect((calls[0].body as { phones: unknown }).phones).toEqual(phones);
  });
});

describe("CrmClient.createPerson without a company", () => {
  it("sends no companyId when none is given, and writes lane as Twenty's UPPER option plus source", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { createPerson: { id: "p_solo" } } })));
    const person = await client.createPerson({
      firstName: "Rae",
      email: "rae@recruit.io",
      lane: "recruiter",
      source: "sales inbox",
    });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/people", method: "POST" });
    expect(calls[0].body).toEqual({
      name: { firstName: "Rae", lastName: "" },
      emails: { primaryEmail: "rae@recruit.io" },
      lane: "RECRUITER",
      source: "sales inbox",
    });
    expect(person.id).toBe("p_solo");
  });
});

describe("CrmClient lane round-trip", () => {
  /** A one-table Twenty: POST /people stores the body as sent, GET /people returns every stored row. */
  function twentyPeople() {
    const rows: any[] = [];
    const fetchImpl = (async (url: string, init?: any) => {
      let payload: unknown;
      if (init?.method === "POST") {
        const row = { id: `p_${rows.length + 1}`, ...JSON.parse(init.body) };
        rows.push(row);
        payload = { data: { createPerson: row } };
      } else {
        payload = { data: { people: rows } };
      }
      return { ok: true, status: 200, json: async () => payload };
    }) as unknown as typeof fetch;
    return new CrmClient(CONFIG, fetchImpl);
  }

  it.each(PERSON_LANES)("a Person created in lane %s reads back in that lane", async (lane) => {
    const client = twentyPeople();
    await client.createPerson({ firstName: "Val", email: `val-${lane}@example.com`, lane });
    const [match] = await client.findPeople({ email: `val-${lane}@example.com` });
    expect(match).toMatchObject({ lane, companyId: null });
  });

  it("reads lane as null for a Person written before the field existed, or holding an unknown option", async () => {
    const client = twentyPeople();
    await client.createPerson({ firstName: "Old", email: "old@example.com" });
    expect((await client.findPeople({ email: "old@example.com" }))[0]?.lane).toBeNull();
    const odd = new CrmClient(
      CONFIG,
      makeFetch([], () => ({ data: { people: [{ id: "p_odd", emails: { primaryEmail: "odd@example.com" }, lane: "COUSIN" }] } })),
    );
    expect((await odd.findPeople({ email: "odd@example.com" }))[0]?.lane).toBeNull();
  });
});

describe("CrmClient.findCompanyByDomain", () => {
  const harbor = { id: "comp_harbor", name: "Harbor Homes LLC", domainName: { primaryLinkUrl: "https://harbor.com" } };
  const lookalike = { id: "comp_not", name: "Not Harbor", domainName: { primaryLinkUrl: "https://notharbor.com" } };

  it("narrows on the server with ilike and returns the exact match", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { companies: [lookalike, harbor] } })));
    const company = await client.findCompanyByDomain("harbor.com");
    expect(decodeURIComponent(calls[0].url)).toBe(
      'https://twenty.test/rest/companies?filter=domainName.primaryLinkUrl[ilike]:"%harbor.com%"&limit=60',
    );
    expect(company).toMatchObject({ id: "comp_harbor", crmUrl: "https://twenty.test/object/company/comp_harbor" });
  });

  it("returns null when only a lookalike domain comes back", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], () => ({ data: { companies: [lookalike] } })));
    expect(await client.findCompanyByDomain("harbor.com")).toBeNull();
  });

  it("returns null when nothing comes back", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], () => ({ data: { companies: [] } })));
    expect(await client.findCompanyByDomain("harbor.com")).toBeNull();
  });

  it.each([
    ["https://www.Harbor.com/about", "harbor.com"],
    ["HARBOR.COM", "https://www.harbor.com/"],
    ["harbor.com", "http://harbor.com:443"],
    ["www.harbor.com.", "harbor.com"],
  ])("treats %s and a stored %s as the same domain", async (input, stored) => {
    const calls: Call[] = [];
    const row = { ...harbor, domainName: { primaryLinkUrl: stored } };
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { companies: [row] } })));
    expect((await client.findCompanyByDomain(input))?.id).toBe("comp_harbor");
    expect(decodeURIComponent(calls[0].url)).toContain('[ilike]:"%harbor.com%"');
  });

  it("makes no request for an empty domain", async () => {
    const calls: Call[] = [];
    expect(await new CrmClient(CONFIG, makeFetch(calls)).findCompanyByDomain("  https://  ")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("CrmClient.ensurePersonFields", () => {
  const LANE_VALUES = PERSON_LANES.map((l) => l.toUpperCase());
  function workspace(fields: unknown, calls: Call[]) {
    return new CrmClient(
      CONFIG,
      makeFetch(calls, (url, method) =>
        method === "GET"
          ? { data: { objects: [{ id: "obj_company", nameSingular: "company", fields: [] }, { id: "obj_person", nameSingular: "person", fields }] } }
          : { data: { createOneField: { id: "f_new" } } },
      ),
    );
  }

  it("a dry run reports both fields missing and writes nothing", async () => {
    const calls: Call[] = [];
    const result = await workspace([{ name: "name", type: "FULL_NAME" }], calls).ensurePersonFields({ apply: false });
    expect(result).toEqual({ present: [], missing: ["lane", "source"], created: [] });
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
    expect(calls[0].url).toBe("https://twenty.test/rest/metadata/objects");
  });

  it("apply creates the missing fields on the person object, lane options in UPPER_SNAKE", async () => {
    const calls: Call[] = [];
    const result = await workspace({ edges: [{ node: { name: "name", type: "FULL_NAME" } }] }, calls).ensurePersonFields({ apply: true });
    expect(result.created).toEqual(["lane", "source"]);
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.url)).toEqual(["https://twenty.test/rest/metadata/fields", "https://twenty.test/rest/metadata/fields"]);
    expect(posts[0]?.body).toMatchObject({ objectMetadataId: "obj_person", name: "lane", type: "SELECT", isNullable: true });
    expect(posts[0]?.body.options.map((o: { value: string }) => o.value)).toEqual(LANE_VALUES);
    expect(posts[1]?.body).toMatchObject({ objectMetadataId: "obj_person", name: "source", type: "TEXT", isNullable: true });
  });

  it("is idempotent: both present means no writes, even with apply", async () => {
    const calls: Call[] = [];
    const fields = [
      { name: "lane", type: "SELECT", options: LANE_VALUES.map((value) => ({ value })) },
      { name: "source", type: "TEXT" },
    ];
    const result = await workspace(fields, calls).ensurePersonFields({ apply: true });
    expect(result).toEqual({ present: ["lane", "source"], missing: [], created: [] });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("refuses, without writing, when lane exists but lacks an option", async () => {
    const calls: Call[] = [];
    const fields = [{ name: "lane", type: "SELECT", options: LANE_VALUES.slice(0, 6).map((value) => ({ value })) }];
    await expect(workspace(fields, calls).ensurePersonFields({ apply: true })).rejects.toThrow("lacks options PERSONAL");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("refuses to create blind when the person object carries no field list", async () => {
    const calls: Call[] = [];
    await expect(workspace(undefined, calls).ensurePersonFields({ apply: true })).rejects.toThrow("refusing to create blind");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

describe("CrmClient.addNote", () => {
  it("creates the note then links it to the company", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, (url) => (url.endsWith("/notes") ? { data: { id: "note1" } } : { data: { id: "nt1" } })),
    );
    const ref = await client.addNote("comp_1", { body: "Agreed to hold the fee this quarter" });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/notes", method: "POST" });
    // bodyV2, never `body`: the note entity has no such field and answers 400.
    expect(calls[0].body).toEqual({
      title: "Agreed to hold the fee this quarter",
      bodyV2: { markdown: "Agreed to hold the fee this quarter" },
    });
    expect(calls[1]).toMatchObject({
      url: "https://twenty.test/rest/noteTargets",
      method: "POST",
      body: { noteId: "note1", companyId: "comp_1" },
    });
    expect(ref).toEqual({ id: "note1", companyId: "comp_1" });
  });

  it("throws when Twenty returns no note id (so a caller never links a phantom note)", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], () => ({ data: {} })));
    await expect(client.addNote("comp_1", { body: "x" })).rejects.toThrow(/no id/);
  });
});

describe("CrmClient tasks — the durable half of anything scheduled", () => {
  const taskRoutes = (url: string) =>
    url.endsWith("/tasks") ? { data: { id: "task1" } } : { data: { id: "tt1" } };

  it("creates the task then links it to the company, in that order", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, taskRoutes));
    const ref = await client.createTask({
      title: "Touch base with Jo",
      dueAt: "2026-08-11T14:00:00-04:00",
      companyId: "comp_1",
      assigneeId: "user_1",
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/tasks", method: "POST" });
    expect(calls[0].body).toEqual({
      title: "Touch base with Jo",
      dueAt: "2026-08-11T14:00:00-04:00",
      assigneeId: "user_1",
    });
    expect(calls[1]).toMatchObject({
      url: "https://twenty.test/rest/taskTargets",
      method: "POST",
      body: { taskId: "task1", companyId: "comp_1" },
    });
    expect(ref.taskUrl).toBe("https://twenty.test/object/task/task1");
    expect(ref.companyId).toBe("comp_1");
  });

  it("creates an UNLINKED task for internal work, with no target call at all", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, taskRoutes));
    const ref = await client.createTask({ title: "New photos at the Harbor", dueAt: "2026-08-14" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://twenty.test/rest/tasks");
    expect(ref.companyId).toBeNull();
  });

  it("omits dueAt entirely rather than sending an empty one", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, taskRoutes));
    await client.createTask({ title: "Someday" });
    expect(calls[0].body).toEqual({ title: "Someday" });
    expect("dueAt" in calls[0].body).toBe(false);
  });

  it("throws when Twenty returns no task id, so nothing links a phantom task", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], () => ({ data: {} })));
    await expect(client.createTask({ title: "x", companyId: "comp_1" })).rejects.toThrow(/no id/);
  });

  it("reschedules by PATCHing dueAt", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({ data: { id: "task1", title: "T" } })),
    );
    const ref = await client.updateTaskDueAt("task1", "2026-08-20T09:00:00-04:00");
    expect(calls[0]).toMatchObject({
      url: "https://twenty.test/rest/tasks/task1",
      method: "PATCH",
      body: { dueAt: "2026-08-20T09:00:00-04:00" },
    });
    expect(ref.dueAt).toBe("2026-08-20T09:00:00-04:00");
  });

  it("moves a task between columns, and what we sent wins over the echo", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "task1", title: "T" } })));
    const ref = await client.updateTaskStatus("task1", "DONE");
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/tasks/task1", method: "PATCH", body: { status: "DONE" } });
    expect(ref.status).toBe("DONE");
    expect(ref.id).toBe("task1");
  });

  it("patches only the task fields given, assignee included", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "task1", title: "T", status: "TODO" } })));
    const ref = await client.updateTask("task1", { assigneeId: "member_alan", status: "DONE" });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/tasks/task1", method: "PATCH" });
    expect(calls[0].body).toEqual({ assigneeId: "member_alan", status: "DONE" });
    expect(ref.status).toBe("DONE");
  });

  it("unassigns with null and never sends an absent field", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "task1" } })));
    await client.updateTask("task1", { assigneeId: null, dueAt: undefined });
    expect(calls[0].body).toEqual({ assigneeId: null });
  });

  it("clears a due date with null, and reports it cleared", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "task1", dueAt: "2026-09-01T00:00:00Z" } })));
    const ref = await client.updateTask("task1", { dueAt: null });
    expect(calls[0].body).toEqual({ dueAt: null });
    expect(ref.dueAt).toBeNull();
  });

  it("patches an opportunity's owner and deletes one by id", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "opp1", name: "Lead", stage: "NEW" } })));
    const ref = await client.updateOpportunity("opp1", { ownerId: "member_alan" });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/opportunities/opp1", method: "PATCH", body: { ownerId: "member_alan" } });
    expect(ref.stage).toBe("NEW");
    await client.deleteOpportunity("opp2");
    expect(calls[1]).toMatchObject({ url: "https://twenty.test/rest/opportunities/opp2", method: "DELETE" });
  });

  it("still moves an opportunity's stage through the patch", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "opp1" } })));
    const ref = await client.updateOpportunityStage("opp1", "MEETING");
    expect(calls[0].body).toEqual({ stage: "MEETING" });
    expect(ref.stage).toBe("MEETING");
  });

  it("patches a company's relationship type", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "comp_1", name: "Mary" } })));
    const ref = await client.updateCompany("comp_1", { relationshipType: "CLIENT" });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/companies/comp_1", method: "PATCH", body: { relationshipType: "CLIENT" } });
    expect(ref.id).toBe("comp_1");
  });

  it("deletes a task by id", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: {} })));
    await client.deleteTask("task1");
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/tasks/task1", method: "DELETE" });
  });

  it("reports null status when Twenty echoes none back on create", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], taskRoutes));
    const ref = await client.createTask({ title: "Someday" });
    expect(ref.status).toBeNull();
  });
});

describe("CrmClient.listTasks — so a commitment can be found again", () => {
  it("reads a company's tasks through taskTargets, because a task carries no company", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({
        data: {
          taskTargets: [
            {
              id: "tt1",
              task: { id: "task1", title: "Confirm the cleaning fee", dueAt: null, status: "TODO" },
            },
          ],
        },
      })),
    );
    const tasks = await client.listTasks({ companyId: "comp_1" });
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(
      "https://twenty.test/rest/taskTargets?filter=companyId[eq]:comp_1&depth=1&limit=50",
    );
    expect(tasks).toEqual([
      {
        id: "task1",
        title: "Confirm the cleaning fee",
        dueAt: null,
        companyId: "comp_1",
        status: "TODO",
        taskUrl: "https://twenty.test/object/task/task1",
      },
    ]);
  });

  it("drops a target row whose task did not come back expanded, rather than guessing at it", async () => {
    const client = new CrmClient(
      CONFIG,
      makeFetch([], () => ({ data: { taskTargets: [{ id: "tt1", taskId: "task1" }] } })),
    );
    expect(await client.listTasks({ companyId: "comp_1" })).toEqual([]);
  });

  it("reads straight off /tasks when no company is named, with no company to report", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({
        data: { tasks: [{ id: "task2", title: "New photos at the Harbor", status: "DONE" }] },
      })),
    );
    const tasks = await client.listTasks();
    expect(calls[0].url).toBe("https://twenty.test/rest/tasks?depth=1&limit=50");
    expect(tasks[0].companyId).toBeNull();
    expect(tasks[0].status).toBe("DONE");
  });

  it("honours a caller's limit", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { tasks: [] } })));
    await client.listTasks({ limit: 5 });
    expect(calls[0].url).toBe("https://twenty.test/rest/tasks?depth=1&limit=5");
  });
});

describe("CrmClient.findPeople", () => {
  // Twenty stores a phone as national digits, calling code in its own field.
  const owner = {
    id: "p_owner",
    name: { firstName: "Pat", lastName: "Lee" },
    emails: { primaryEmail: "pat.lee@example.com", additionalEmails: [] },
    phones: { primaryPhoneNumber: "3603039131", primaryPhoneCallingCode: "+1", primaryPhoneCountryCode: "US" },
    companyId: "comp_1",
  };

  /** Answers every /people query with `rows`, whatever the filter, so the
   * exact match is proven to happen in the client, not on the server. */
  function clientWith(rows: unknown[], calls: Call[] = []) {
    return new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { people: rows } })));
  }

  it("finds by email case-insensitively and returns the linked company", async () => {
    const calls: Call[] = [];
    const results = await clientWith([owner], calls).findPeople({ email: "Pat.Lee@EXAMPLE.com" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://twenty.test/rest/people?filter=emails.primaryEmail%5Bilike%5D%3A%22pat.lee%40example.com%22&limit=60",
    );
    expect(results).toEqual([
      { id: "p_owner", name: "Pat Lee", email: "pat.lee@example.com", phone: "3603039131", companyId: "comp_1", lane: null },
    ]);
  });

  it("drops an ilike wildcard hit that is not the same address", async () => {
    const lookalike = { ...owner, id: "p_other", emails: { primaryEmail: "pat.lee@examplexcom" } };
    const results = await clientWith([lookalike]).findPeople({ email: "pat.lee@example.com" });
    expect(results).toEqual([]);
  });

  it.each(["+13603039131", "(360) 303-9131", "360.303.9131", "3603039131", "1-360-303-9131"])(
    "finds by phone given as %s, filtering server-side on the last four digits",
    async (input) => {
      const calls: Call[] = [];
      const results = await clientWith([owner], calls).findPeople({ phone: input });
      expect(decodeURIComponent(calls[0].url)).toContain('filter=phones.primaryPhoneNumber[like]:"%9131"');
      expect(results.map((p) => p.id)).toEqual(["p_owner"]);
    },
  );

  it.each(["+13603039131", "(360) 303-9131", "+1 360-303-9131"])(
    "matches a phone stored as %s",
    async (stored) => {
      const row = { ...owner, phones: { primaryPhoneNumber: stored } };
      const results = await clientWith([row]).findPeople({ phone: "360.303.9131" });
      expect(results.map((p) => p.id)).toEqual(["p_owner"]);
    },
  );

  it("drops a row that shares the last four digits but not the last ten", async () => {
    const neighbour = { ...owner, id: "p_neighbour", phones: { primaryPhoneNumber: "8135559131" } };
    expect(await clientWith([neighbour]).findPeople({ phone: "+13603039131" })).toEqual([]);
  });

  it("returns nothing when nobody matches", async () => {
    expect(await clientWith([]).findPeople({ email: "nobody@example.com", phone: "3605550000" })).toEqual([]);
  });

  it("returns companyId null for a person with no company", async () => {
    const { companyId: _drop, ...unlinked } = owner;
    const results = await clientWith([unlinked]).findPeople({ email: "pat.lee@example.com" });
    expect(results).toEqual([
      { id: "p_owner", name: "Pat Lee", email: "pat.lee@example.com", phone: "3603039131", companyId: null, lane: null },
    ]);
  });

  it("unions email and phone hits, deduped by id", async () => {
    const texter = { ...owner, id: "p_texter", emails: { primaryEmail: "other@example.com" } };
    const client = new CrmClient(
      CONFIG,
      makeFetch([], (url) => ({ data: { people: url.includes("emails") ? [owner] : [owner, texter] } })),
    );
    const results = await client.findPeople({ email: "pat.lee@example.com", phone: "3603039131" });
    expect(results.map((p) => p.id)).toEqual(["p_owner", "p_texter"]);
  });

  it("finds a number held in additionalPhones, and never a neighbour that only shares four digits", async () => {
    const second = { ...owner, id: "p_second", phones: { primaryPhoneNumber: "8135550000", additionalPhones: [{ number: "3603039131", callingCode: "+1" }] } };
    const neighbour = { ...owner, id: "p_n", phones: { primaryPhoneNumber: "8135550001", additionalPhones: [{ number: "8135559131" }] } };
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, (url) => ({ data: { people: decodeURIComponent(url).includes("additionalPhones") ? [second, neighbour] : [] } })),
    );
    const results = await client.findPeople({ phone: "+1 (360) 303-9131" });
    expect(decodeURIComponent(calls[1].url)).toContain('filter=phones.additionalPhones[like]:"%9131%"');
    expect(results.map((p) => p.id)).toEqual(["p_second"]);
  });

  it("keeps the primary match when Twenty refuses the additionalPhones filter", async () => {
    const client = new CrmClient(CONFIG, (async (url: string) =>
      decodeURIComponent(url).includes("additionalPhones")
        ? { ok: false, status: 400, text: async () => "bad filter", json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ data: { people: [owner] } }) }) as unknown as typeof fetch);
    expect((await client.findPeople({ phone: "3603039131" })).map((p) => p.id)).toEqual(["p_owner"]);
  });

  it("makes no request and returns [] when given neither field", async () => {
    const calls: Call[] = [];
    expect(await clientWith([owner], calls).findPeople({})).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("CrmClient.renamePerson", () => {
  it("PATCHes only the name, last name blank when not given", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { updatePerson: { id: "p1", name: { firstName: "Dana", lastName: "" } } } })));
    const ref = await client.renamePerson("p1", { firstName: "Dana" });
    expect(calls).toEqual([{ url: "https://twenty.test/rest/people/p1", method: "PATCH", body: { name: { firstName: "Dana", lastName: "" } } }]);
    expect(ref.id).toBe("p1");
  });
});

describe("a refused Twenty call", () => {
  it("throws with the status and Twenty's own message, trimmed", async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 400,
      text: async () => '{"statusCode":400,\n "messages":["Invalid phone number"],"error":"BadRequestException"}',
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const client = new CrmClient(CONFIG, fetchImpl);
    await expect(client.createPerson({ firstName: "x", phone: "7877174922" })).rejects.toThrow(
      'crm POST /people failed: 400 {"statusCode":400, "messages":["Invalid phone number"],"error":"BadRequestException"}',
    );
  });

  it("still throws the status when the body cannot be read", async () => {
    const fetchImpl = (async () => ({ ok: false, status: 502, text: async () => { throw new Error("gone"); } })) as unknown as typeof fetch;
    await expect(new CrmClient(CONFIG, fetchImpl).createPerson({ firstName: "x" })).rejects.toThrow(/^crm POST \/people failed: 502$/);
  });
});
