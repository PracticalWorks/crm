// What the CRM tells the agent fleets when a lead moves. The Twenty App in
// `twenty-app/` runs `opportunityEvents` on every Opportunity create and on every
// update that touches stage, Type, Step or Outcome, and sends what it returns to
// Inngest's event API. Consumers import the names and payload types from here, so
// the sender and every listener share one contract.

import { LEAD_STAGES, type LeadOutcome, type LeadStage, type LeadStep, type LeadType } from "./lead-record.js";

export const OPPORTUNITY_EVENTS = {
  /** A lead was created. */
  OPENED: "crm/opportunity.opened",
  /** The stage moved, by a drag on a board or by a writer. */
  STAGE_CHANGED: "crm/opportunity.stage-changed",
  /** The lead reached Closed, or its outcome was set or changed while Closed. */
  CLOSED: "crm/opportunity.closed",
  /** Type or Step moved while the stage stayed where it was. */
  UPDATED: "crm/opportunity.updated",
} as const;
export type OpportunityEventName = (typeof OPPORTUNITY_EVENTS)[keyof typeof OPPORTUNITY_EVENTS];

/** The fields an update must touch for the app to look at it. */
export const OPPORTUNITY_WATCHED_FIELDS = ["stage", "leadType", "step", "outcome"] as const;

/** The Opportunity as the event carries it: the record's own fields, relations as ids. */
export type OpportunitySnapshot = {
  id?: string;
  name?: string | null;
  stage?: LeadStage | string | null;
  leadType?: LeadType | string | null;
  step?: LeadStep | string | null;
  outcome?: LeadOutcome | string | null;
  brandId?: string | null;
  ownerId?: string | null;
  updatedAt?: string | null;
  [field: string]: unknown;
};

export type OpportunityDiff = Partial<Record<string, { before: unknown; after: unknown }>>;

/** Every event's `data`. `before` and `diff` are null on `opened`. */
export type OpportunityEventData = {
  opportunityId: string;
  /** The workspace member who made the change, when a person did. */
  actorId: string | null;
  brandId: string | null;
  type: string | null;
  stage: string | null;
  ownerId: string | null;
  before: OpportunitySnapshot | null;
  after: OpportunitySnapshot;
  diff: OpportunityDiff | null;
  updatedFields: string[];
};
export type OpportunityStageChangedData = OpportunityEventData & { fromStage: string | null; toStage: string | null };
export type OpportunityClosedData = OpportunityEventData & { outcome: string | null };

export type OpportunityEvent =
  | { name: typeof OPPORTUNITY_EVENTS.OPENED; id: string; data: OpportunityEventData }
  | { name: typeof OPPORTUNITY_EVENTS.STAGE_CHANGED; id: string; data: OpportunityStageChangedData }
  | { name: typeof OPPORTUNITY_EVENTS.CLOSED; id: string; data: OpportunityClosedData }
  | { name: typeof OPPORTUNITY_EVENTS.UPDATED; id: string; data: OpportunityEventData };

export type OpportunityChange =
  | { operation: "created"; recordId: string; actorId?: string | null; after: OpportunitySnapshot }
  | {
      operation: "updated";
      recordId: string;
      actorId?: string | null;
      before: OpportunitySnapshot;
      after: OpportunitySnapshot;
      diff?: OpportunityDiff;
      updatedFields?: string[];
    };

const changed = (before: OpportunitySnapshot, after: OpportunitySnapshot, field: string): boolean =>
  (before[field] ?? null) !== (after[field] ?? null);

/**
 * The events one Opportunity change produces, in the order a listener should see
 * them. Pure: the same change always yields the same events with the same ids, so a
 * retried send is deduplicated by Inngest (its `id` is an idempotency key).
 */
export function opportunityEvents(change: OpportunityChange): OpportunityEvent[] {
  const { after, recordId } = change;
  const before = change.operation === "updated" ? change.before : null;
  const diff = change.operation === "updated" ? (change.diff ?? null) : null;
  const updatedFields = change.operation === "updated" ? (change.updatedFields ?? Object.keys(diff ?? {})) : [];
  const base: OpportunityEventData = {
    opportunityId: recordId,
    actorId: change.actorId ?? null,
    brandId: after.brandId ?? null,
    type: after.leadType ?? null,
    stage: after.stage ?? null,
    ownerId: after.ownerId ?? null,
    before,
    after,
    diff,
    updatedFields,
  };
  // One version of the record per id: a retry of this change reuses it, a later change does not.
  const version = after.updatedAt ?? "created";
  const id = (name: string) => `${recordId}:${name}:${version}`;

  if (change.operation === "created") {
    return [{ name: OPPORTUNITY_EVENTS.OPENED, id: id(OPPORTUNITY_EVENTS.OPENED), data: base }];
  }

  const prior = change.before;
  const events: OpportunityEvent[] = [];
  const stageMoved = changed(prior, after, "stage");
  if (stageMoved) {
    events.push({
      name: OPPORTUNITY_EVENTS.STAGE_CHANGED,
      id: id(OPPORTUNITY_EVENTS.STAGE_CHANGED),
      data: { ...base, fromStage: prior.stage ?? null, toStage: after.stage ?? null },
    });
  }
  const isClosed = after.stage === LEAD_STAGES.CLOSED;
  const enteredClosed = isClosed && stageMoved;
  const outcomeSetWhileClosed = isClosed && !stageMoved && changed(prior, after, "outcome") && after.outcome != null;
  if (enteredClosed || outcomeSetWhileClosed) {
    events.push({
      name: OPPORTUNITY_EVENTS.CLOSED,
      id: id(OPPORTUNITY_EVENTS.CLOSED),
      data: { ...base, outcome: after.outcome ?? null },
    });
  }
  if (!stageMoved && (changed(prior, after, "leadType") || changed(prior, after, "step"))) {
    events.push({ name: OPPORTUNITY_EVENTS.UPDATED, id: id(OPPORTUNITY_EVENTS.UPDATED), data: base });
  }
  return events;
}
