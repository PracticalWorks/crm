import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrmClient } from "./client.js";

interface Call {
  url: string;
  method?: string;
  body?: any;
}

/** A fake Twenty: records every request and answers each with `routes`. */
function makeFetch(calls: Call[], routes: (url: string, method?: string) => unknown = () => ({})) {
  return (async (url: string, init?: any) => {
    calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined });
    return { ok: true, status: 200, json: async () => routes(url, init?.method) };
  }) as unknown as typeof fetch;
}

const CONFIG = { baseUrl: "https://twenty.test", apiKey: "k" };

const cycle = (id: string, startDate: string | null, endDate: string | null, sequenceKey = "agency-intro") => ({
  id,
  sequenceKey,
  brandId: "brand_1",
  startDate,
  endDate,
  verdict: null,
  audience: "Agency owners",
});

/** A Twenty holding these cycles, answering the sequence-key filter the way Twenty would. */
function cycles(records: ReturnType<typeof cycle>[], calls: Call[]) {
  return new CrmClient(
    CONFIG,
    makeFetch(calls, (url) => {
      const key = decodeURIComponent(url).match(/sequenceKey\[eq\]:"([^"]*)"/)?.[1];
      return { data: { outreachCycles: records.filter((r) => key === undefined || r.sequenceKey === key) } };
    }),
  );
}

describe("CrmClient.findOutreachCycle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns the cycle with that key whose window holds today, asking Twenty for the key alone", async () => {
    const calls: Call[] = [];
    const found = await cycles(
      [cycle("cyc_old", "2026-11-01", "2026-11-14"), cycle("cyc_now", "2026-11-15", "2026-11-28"), cycle("cyc_other", "2026-11-15", "2026-11-28", "other")],
      calls,
    ).findOutreachCycle("agency-intro");
    expect(found).toEqual({
      id: "cyc_now",
      sequenceKey: "agency-intro",
      brandId: "brand_1",
      startDate: "2026-11-15",
      endDate: "2026-11-28",
      verdict: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
    expect(decodeURIComponent(calls[0]!.url)).toContain('/rest/outreachCycles?filter=sequenceKey[eq]:"agency-intro"');
  });

  it("counts the first and the last day of the window as inside it", async () => {
    expect((await cycles([cycle("cyc_1", "2026-11-26", "2026-12-09")], []).findOutreachCycle("agency-intro"))?.id).toBe("cyc_1");
    expect((await cycles([cycle("cyc_2", "2026-11-13", "2026-11-26")], []).findOutreachCycle("agency-intro"))?.id).toBe("cyc_2");
  });

  it("reads a cycle with no end date as still running once it has started", async () => {
    expect((await cycles([cycle("cyc_open", "2026-11-20", null)], []).findOutreachCycle("agency-intro"))?.id).toBe("cyc_open");
  });

  it("is null when no cycle has the key", async () => {
    expect(await cycles([cycle("cyc_now", "2026-11-15", "2026-11-28", "other")], []).findOutreachCycle("agency-intro")).toBeNull();
  });

  it("ignores another key's running cycle even when Twenty returns it unfiltered", async () => {
    const client = new CrmClient(CONFIG, makeFetch([], () => ({ data: { outreachCycles: [cycle("cyc_other", "2026-11-15", "2026-11-28", "other")] } })));
    expect(await client.findOutreachCycle("agency-intro")).toBeNull();
  });

  it("is null when the key's cycles have ended, have not started, or have no start date", async () => {
    const found = await cycles(
      [cycle("cyc_ended", "2026-11-01", "2026-11-25"), cycle("cyc_next", "2026-11-27", "2026-12-10"), cycle("cyc_undated", null, null)],
      [],
    ).findOutreachCycle("agency-intro");
    expect(found).toBeNull();
  });

  it("refuses two cycles of one key whose windows both hold today, naming them", async () => {
    await expect(
      cycles([cycle("cyc_a", "2026-11-15", "2026-11-28"), cycle("cyc_b", "2026-11-20", null)], []).findOutreachCycle("agency-intro"),
    ).rejects.toThrow("cyc_a, cyc_b");
  });

  it("refuses a blank key before calling Twenty", async () => {
    const calls: Call[] = [];
    await expect(cycles([], calls).findOutreachCycle("  ")).rejects.toThrow("sequenceKey is required");
    expect(calls).toHaveLength(0);
  });
});

describe("Opportunity outreachCycleId", () => {
  it("createOpportunity sends the cycle's join column and the ref carries it", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { createOpportunity: { id: "opp_1" } } })));
    const ref = await client.createOpportunity({ name: "Reply from Ana", companyId: "comp_1", outreachCycleId: "cyc_now" });
    expect(calls[0]!.body).toEqual({ name: "Reply from Ana", companyId: "comp_1", outreachCycleId: "cyc_now" });
    expect(ref.outreachCycleId).toBe("cyc_now");
  });

  it("updateOpportunity sets and clears it", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(CONFIG, makeFetch(calls, () => ({ data: { updateOpportunity: { id: "opp_1" } } })));
    expect((await client.updateOpportunity("opp_1", { outreachCycleId: "cyc_now" })).outreachCycleId).toBe("cyc_now");
    expect((await client.updateOpportunity("opp_1", { outreachCycleId: null })).outreachCycleId).toBeNull();
    expect(calls.map((c) => c.body)).toEqual([{ outreachCycleId: "cyc_now" }, { outreachCycleId: null }]);
  });

  it("listOpportunities reads it from the join column or the depth-1 relation, and leaves it out when absent", async () => {
    const client = new CrmClient(
      CONFIG,
      makeFetch([], () => ({
        data: {
          opportunities: [
            { id: "opp_1", name: "A", outreachCycleId: "cyc_1" },
            { id: "opp_2", name: "B", outreachCycle: { id: "cyc_2" } },
            { id: "opp_3", name: "C" },
          ],
        },
      })),
    );
    const [a, b, c] = await client.listOpportunities();
    expect(a!.outreachCycleId).toBe("cyc_1");
    expect(b!.outreachCycleId).toBe("cyc_2");
    expect(c).not.toHaveProperty("outreachCycleId");
  });
});
