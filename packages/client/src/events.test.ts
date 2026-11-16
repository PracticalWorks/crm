import { describe, expect, it } from "vitest";
import { OPPORTUNITY_EVENTS, opportunityEvents, type OpportunitySnapshot } from "./events.js";
import { LEAD_STAGES } from "./lead-record.js";

const lead = (fields: Partial<OpportunitySnapshot> = {}): OpportunitySnapshot => ({
  id: "opp1",
  name: "Floor for a shop",
  stage: LEAD_STAGES.TRIAGED,
  leadType: "PROJECT",
  step: null,
  outcome: null,
  brandId: "brand1",
  ownerId: "member1",
  updatedAt: "2026-11-16T19:00:00.000Z",
  ...fields,
});

const update = (before: OpportunitySnapshot, after: OpportunitySnapshot) =>
  opportunityEvents({ operation: "updated", recordId: "opp1", actorId: "member2", before, after });

describe("opportunityEvents", () => {
  it("opens a created lead with brand, type, stage and owner", () => {
    const [opened, ...rest] = opportunityEvents({ operation: "created", recordId: "opp1", after: lead({ stage: LEAD_STAGES.NEW }) });
    expect(rest).toEqual([]);
    expect(opened).toMatchObject({
      name: "crm/opportunity.opened",
      id: "opp1:crm/opportunity.opened:2026-11-16T19:00:00.000Z",
      data: { opportunityId: "opp1", brandId: "brand1", type: "PROJECT", stage: "NEW", ownerId: "member1", before: null, diff: null, actorId: null },
    });
  });

  it("sends one stage change with both stages when a lead is dragged to Engaged", () => {
    const events = update(lead(), lead({ stage: LEAD_STAGES.ENGAGED, updatedAt: "2026-11-16T19:05:00.000Z" }));
    expect(events.map((e) => e.name)).toEqual([OPPORTUNITY_EVENTS.STAGE_CHANGED]);
    expect(events[0]!.data).toMatchObject({ fromStage: "SCREENING", toStage: "MEETING", stage: "MEETING", actorId: "member2", updatedFields: [] });
    expect(events[0]!.data.before?.stage).toBe("SCREENING");
  });

  it("closes with the outcome when the lead reaches Closed", () => {
    const events = update(lead({ stage: LEAD_STAGES.PROPOSAL_OUT }), lead({ stage: LEAD_STAGES.CLOSED, outcome: "WON" }));
    expect(events.map((e) => e.name)).toEqual([OPPORTUNITY_EVENTS.STAGE_CHANGED, OPPORTUNITY_EVENTS.CLOSED]);
    expect(events[1]!.data).toMatchObject({ outcome: "WON", stage: "CUSTOMER" });
  });

  it("closes again when the outcome is set on a lead already Closed, but not when it is cleared", () => {
    const closed = lead({ stage: LEAD_STAGES.CLOSED });
    expect(update(closed, { ...closed, outcome: "LOST" }).map((e) => e.name)).toEqual([OPPORTUNITY_EVENTS.CLOSED]);
    expect(update({ ...closed, outcome: "LOST" }, closed)).toEqual([]);
  });

  it("reports a Type or Step move with no stage change as an update, and nothing else as anything", () => {
    expect(update(lead(), lead({ step: "APPLIED" })).map((e) => e.name)).toEqual([OPPORTUNITY_EVENTS.UPDATED]);
    expect(update(lead(), lead({ leadType: "PARTNER" })).map((e) => e.name)).toEqual([OPPORTUNITY_EVENTS.UPDATED]);
    expect(update(lead(), lead({ name: "Renamed" }))).toEqual([]);
    expect(update(lead(), lead({ stage: LEAD_STAGES.ENGAGED, step: "APPLIED" })).map((e) => e.name)).toEqual([OPPORTUNITY_EVENTS.STAGE_CHANGED]);
  });

  it("gives a retried change the same ids and a later change new ones", () => {
    const first = update(lead(), lead({ stage: LEAD_STAGES.ENGAGED, updatedAt: "t1" }));
    const retried = update(lead(), lead({ stage: LEAD_STAGES.ENGAGED, updatedAt: "t1" }));
    const later = update(lead({ stage: LEAD_STAGES.ENGAGED }), lead({ stage: LEAD_STAGES.PROPOSAL_OUT, updatedAt: "t2" }));
    expect(retried[0]!.id).toBe(first[0]!.id);
    expect(later[0]!.id).not.toBe(first[0]!.id);
  });

  it("takes updatedFields from the event, or from the diff when the event has none", () => {
    const diff = { stage: { before: "SCREENING", after: "MEETING" } };
    const before = lead();
    const after = lead({ stage: LEAD_STAGES.ENGAGED });
    expect(opportunityEvents({ operation: "updated", recordId: "opp1", before, after, diff })[0]!.data.updatedFields).toEqual(["stage"]);
    expect(opportunityEvents({ operation: "updated", recordId: "opp1", before, after, diff, updatedFields: ["stage", "step"] })[0]!.data.updatedFields).toEqual(["stage", "step"]);
  });
});
