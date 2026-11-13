import { describe, expect, it } from "vitest";
import { CrmClient } from "./client.js";
import { LEAD_MARKETS, LEAD_OUTCOMES, LEAD_SOURCES, LEAD_STAGES, LEAD_STEPS, LEAD_TYPES, TRIAGE_VERDICTS } from "./lead-record.js";

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

describe("lead record option lists", () => {
  it("are UPPER_SNAKE, unique and within Twenty's 63-character limit", () => {
    for (const list of [LEAD_SOURCES, LEAD_TYPES, LEAD_MARKETS, LEAD_STEPS, TRIAGE_VERDICTS, LEAD_OUTCOMES]) {
      const values = list.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
      for (const v of values) expect(v).toMatch(/^[A-Z][A-Z0-9_]{0,62}$/);
      for (const o of list) expect(o.label).not.toContain(",");
    }
  });

  it("keeps the four live stage values until every writer sends the constants", () => {
    expect(LEAD_STAGES).toEqual({
      NEW: "NEW",
      TRIAGED: "SCREENING",
      LIGHT_REPLY_SENT: "LIGHT_REPLY_SENT",
      ENGAGED: "MEETING",
      PROPOSAL_OUT: "PROPOSAL",
      CLOSED: "CUSTOMER",
    });
  });

  it("names the five types the win-rate rankings filter on", () => {
    expect(LEAD_TYPES.map((t) => t.value)).toEqual(["PROJECT", "CONTRACT_SEAT", "JOB_APPLICATION", "PRODUCT_SIGNUP", "PARTNER"]);
  });
});

describe("CrmClient.createOpportunity with lead fields", () => {
  it("sends Twenty's API names (leadType, leadLinks) and LINKS composites, and reads them back", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { createOpportunity: { id: "opp_1" } } })));
    const ref = await client.createOpportunity({
      name: "Website rebuild",
      companyId: "comp_1",
      stage: LEAD_STAGES.NEW,
      brandId: "brand_1",
      ownerId: "member_1",
      source: "UPWORK",
      sourceDetail: { url: "https://jobs.test/posting/9", label: "posting 9" },
      market: "SAAS_STARTUP",
      type: "PROJECT",
      triageVerdict: "WORK",
      links: ["https://app.test/lead/9", { url: "https://app.test/lead/9/doc", label: "one-pager" }],
    });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/opportunities", method: "POST" });
    expect(calls[0]!.body).toEqual({
      name: "Website rebuild",
      companyId: "comp_1",
      stage: "NEW",
      brandId: "brand_1",
      ownerId: "member_1",
      source: "UPWORK",
      sourceDetail: { primaryLinkUrl: "https://jobs.test/posting/9", primaryLinkLabel: "posting 9", secondaryLinks: [] },
      market: "SAAS_STARTUP",
      leadType: "PROJECT",
      triageVerdict: "WORK",
      leadLinks: {
        primaryLinkUrl: "https://app.test/lead/9",
        primaryLinkLabel: "",
        secondaryLinks: [{ url: "https://app.test/lead/9/doc", label: "one-pager" }],
      },
    });
    expect(ref).toMatchObject({
      id: "opp_1",
      name: "Website rebuild",
      stage: "NEW",
      companyId: "comp_1",
      brandId: "brand_1",
      type: "PROJECT",
      sourceDetail: "https://jobs.test/posting/9",
      links: ["https://app.test/lead/9", "https://app.test/lead/9/doc"],
    });
  });

  it("sends exactly the old body when no lead field is given", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "opp_2" } })));
    const ref = await client.createOpportunity({ name: "Plain", companyId: "comp_1" });
    expect(calls[0]!.body).toEqual({ name: "Plain", companyId: "comp_1" });
    expect(ref).toEqual({ id: "opp_2", name: "Plain", stage: null, companyId: "comp_1", opportunityUrl: "https://twenty.test/object/opportunity/opp_2" });
  });
});

describe("CrmClient.updateOpportunity with lead fields", () => {
  it("sends only the fields given; null clears a value and an empty composite clears links", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { updateOpportunity: { id: "opp_1", name: "X" } } })));
    await client.updateOpportunity("opp_1", { triageVerdict: "PASS", passReason: "staffing firm", brandId: null, links: null });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/opportunities/opp_1", method: "PATCH" });
    expect(calls[0]!.body).toEqual({
      triageVerdict: "PASS",
      passReason: "staffing firm",
      brandId: null,
      leadLinks: { primaryLinkUrl: "", primaryLinkLabel: "", secondaryLinks: [] },
    });
  });
});

describe("CrmClient.setStep and close", () => {
  it("setStep patches the step alone", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "opp_1" } })));
    const ref = await client.setStep("opp_1", "INMAIL_SENT");
    expect(calls[0]!.body).toEqual({ step: "INMAIL_SENT" });
    expect(ref.step).toBe("INMAIL_SENT");
  });

  it("close moves to the Closed stage with outcome, scoping hours and the given close date", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "opp_1" } })));
    const ref = await client.close("opp_1", { outcome: "WON", scopingHours: 3.5, closeDate: "2026-11-13T00:00:00.000Z" });
    expect(calls[0]!.body).toEqual({ stage: "CUSTOMER", outcome: "WON", scopingHours: 3.5, closeDate: "2026-11-13T00:00:00.000Z" });
    expect(ref).toMatchObject({ stage: "CUSTOMER", outcome: "WON", scopingHours: 3.5 });
  });

  it("close without scoping hours leaves them unset and stamps a close date", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { id: "opp_1" } })));
    await client.close("opp_1", { outcome: "NO_REPLY" });
    expect(calls[0]!.body).not.toHaveProperty("scopingHours");
    expect(calls[0]!.body.closeDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("CrmClient brands", () => {
  it("listBrands maps records, the note link to its URL", async () => {
    const client = new CrmClient(
      CONFIG,
      makeFetch([], () => ({
        data: {
          brands: [
            { id: "b1", key: "alpha", name: "Alpha", shortTag: "AL", ownerId: "m1", vaultNote: { primaryLinkUrl: "https://vault.test/alpha" }, goal: null },
            { id: "b2", key: "beta", name: "Beta" },
          ],
        },
      })),
    );
    expect(await client.listBrands()).toEqual([
      { id: "b1", key: "alpha", name: "Alpha", shortTag: "AL", ownerId: "m1", vaultNote: "https://vault.test/alpha", goal: null },
      { id: "b2", key: "beta", name: "Beta", shortTag: null, ownerId: null, vaultNote: null, goal: null },
    ]);
  });

  it("upsertBrand creates a brand whose key is not there yet", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, (_url, method) => (method === "GET" ? { data: { brands: [] } } : { data: { createBrand: { id: "b9" } } })),
    );
    const ref = await client.upsertBrand({ key: "alpha", name: "Alpha", shortTag: "AL", vaultNote: "https://vault.test/alpha" });
    expect(decodeURIComponent(calls[0]!.url)).toBe('https://twenty.test/rest/brands?filter=key[eq]:"alpha"&limit=2');
    expect(calls[1]).toMatchObject({ url: "https://twenty.test/rest/brands", method: "POST" });
    expect(calls[1]!.body).toEqual({
      key: "alpha",
      name: "Alpha",
      shortTag: "AL",
      vaultNote: { primaryLinkUrl: "https://vault.test/alpha", primaryLinkLabel: "", secondaryLinks: [] },
    });
    expect(ref).toMatchObject({ id: "b9", key: "alpha", vaultNote: "https://vault.test/alpha" });
  });

  it("upsertBrand updates the brand that has the key, sending only what was given", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, (_url, method) =>
        method === "GET"
          ? { data: { brands: [{ id: "b1", key: "alpha", name: "Old", ownerId: "m1" }] } }
          : { data: { updateBrand: { id: "b1" } } },
      ),
    );
    const ref = await client.upsertBrand({ key: "alpha", name: "Alpha", goal: "2 inquiries a month by 2026-12-31" });
    expect(calls[1]).toMatchObject({ url: "https://twenty.test/rest/brands/b1", method: "PATCH" });
    expect(calls[1]!.body).toEqual({ key: "alpha", name: "Alpha", goal: "2 inquiries a month by 2026-12-31" });
    expect(ref).toMatchObject({ id: "b1", name: "Alpha", ownerId: "m1" });
  });

  it("upsertBrand refuses a blank key before calling Twenty", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls));
    await expect(client.upsertBrand({ key: "  ", name: "X" })).rejects.toThrow("key is required");
    expect(calls).toHaveLength(0);
  });
});

describe("CrmClient.updatePerson", () => {
  it("patches only the defined fields, custom ones included, and null clears", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(
      CONFIG,
      makeFetch(calls, () => ({ data: { updatePerson: { id: "p1", name: { firstName: "Ada", lastName: "L" } } } })),
    );
    const ref = await client.updatePerson("p1", {
      outreachSequence: "seq-a",
      outreachStep: 2,
      outreachLastSentAt: "2026-11-13T15:00:00.000Z",
      outreachState: null,
      untouched: undefined,
    });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/people/p1", method: "PATCH" });
    expect(calls[0]!.body).toEqual({
      outreachSequence: "seq-a",
      outreachStep: 2,
      outreachLastSentAt: "2026-11-13T15:00:00.000Z",
      outreachState: null,
    });
    expect(ref).toEqual({ id: "p1", firstName: "Ada", lastName: "L", email: null, phone: null });
  });
});

describe("CrmClient.ensureFields", () => {
  const specs = [
    { name: "outreachStep", label: "Outreach step", type: "NUMBER" },
    { name: "outreachState", label: "Outreach state", type: "SELECT", options: [{ value: "ACTIVE", label: "Active", position: 0 }] },
  ];
  function workspace(fields: unknown, calls: Call[]) {
    return new CrmClient(
      CONFIG,
      makeFetch(calls, (url, method) =>
        method === "GET" && url.endsWith("/metadata/objects")
          ? { data: { objects: [{ id: "obj_person", nameSingular: "person", fields }] } }
          : { data: {} },
      ),
    );
  }

  it("reports what is missing and writes nothing without apply", async () => {
    const calls: Call[] = [];
    const result = await workspace([{ name: "outreachStep", type: "NUMBER" }], calls).ensureFields("person", specs, { apply: false });
    expect(result).toEqual({ present: ["outreachStep"], missing: ["outreachState"], created: [] });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("creates each missing field, nullable, on the named object, with apply", async () => {
    const calls: Call[] = [];
    const result = await workspace([], calls).ensureFields("person", specs, { apply: true });
    expect(result.created).toEqual(["outreachStep", "outreachState"]);
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.url)).toEqual(["https://twenty.test/rest/metadata/fields", "https://twenty.test/rest/metadata/fields"]);
    expect(posts[1]!.body).toMatchObject({ name: "outreachState", type: "SELECT", objectMetadataId: "obj_person", isNullable: true });
  });

  it("refuses an object the workspace does not have", async () => {
    await expect(workspace([], []).ensureFields("invoice", specs, { apply: true })).rejects.toThrow("no invoice object");
  });

  it("refuses a field that exists with another type, never overwriting it", async () => {
    const calls: Call[] = [];
    await expect(workspace([{ name: "outreachStep", type: "TEXT" }], calls).ensureFields("person", specs, { apply: true })).rejects.toThrow(
      "person.outreachStep is TEXT, expected NUMBER",
    );
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

describe("OUTREACH_PERSON_FIELDS", () => {
  it("are the four fields frontdesk writes, each a shape ensureFields can check", async () => {
    const { OUTREACH_PERSON_FIELDS, OUTREACH_STATES } = await import("./index.js");
    expect(OUTREACH_PERSON_FIELDS.map((f) => `${f.name}:${f.type}`)).toEqual([
      "outreachSequence:TEXT",
      "outreachStep:NUMBER",
      "outreachLastSentAt:DATE_TIME",
      "outreachState:SELECT",
    ]);
    const stateField = OUTREACH_PERSON_FIELDS.find((f) => f.name === "outreachState") as { options?: readonly { value: string }[] };
    expect(stateField.options?.map((o) => o.value)).toEqual(["ACTIVE", "REPLIED", "OPTED_OUT", "BOUNCED", "FINISHED"]);
    expect(OUTREACH_STATES.every((o) => /^[A-Z_]+$/.test(o.value))).toBe(true);
  });
});
