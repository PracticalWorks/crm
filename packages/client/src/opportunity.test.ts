import { describe, expect, it } from "vitest";
import { CrmClient } from "./client.js";

type Call = { url: string; method?: string; body?: any };
const config = { baseUrl: "https://twenty.test", apiKey: "key" };
function fetchMock(calls: Call[], response: any): typeof fetch {
  return (async (input, init) => {
    calls.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("CrmClient opportunities", () => {
  it("creates an opportunity against a company and returns its deep link", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(config, fetchMock(calls, { data: { id: "opp1" } }));
    const ref = await client.createOpportunity({ name: "Website rebuild", stage: "QUALIFIED", companyId: "company1" });
    expect(calls[0]).toMatchObject({ url: "https://twenty.test/rest/opportunities", method: "POST", body: { name: "Website rebuild", stage: "QUALIFIED", companyId: "company1" } });
    expect(ref).toEqual({ id: "opp1", name: "Website rebuild", stage: "QUALIFIED", companyId: "company1", opportunityUrl: "https://twenty.test/object/opportunity/opp1" });
  });

  it("lists company opportunities and updates their stage", async () => {
    const calls: Call[] = [];
    let callNumber = 0;
    const client = new CrmClient(config, (async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      callNumber += 1;
      const data = callNumber === 1
        ? { opportunities: [{ id: "opp1", name: "Website rebuild", stage: "PROPOSAL", companyId: "company1" }] }
        : { id: "opp1", name: "Website rebuild", stage: "WON", companyId: "company1" };
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as typeof fetch);
    const listed = await client.listOpportunities({ companyId: "company1" });
    expect(listed).toEqual([{ id: "opp1", name: "Website rebuild", stage: "PROPOSAL", companyId: "company1", opportunityUrl: "https://twenty.test/object/opportunity/opp1" }]);
    const updated = await client.updateOpportunityStage("opp1", "WON");
    expect(calls[1]).toMatchObject({ url: "https://twenty.test/rest/opportunities/opp1", method: "PATCH", body: { stage: "WON" } });
    expect(updated.opportunityUrl).toBe("https://twenty.test/object/opportunity/opp1");
  });
});
