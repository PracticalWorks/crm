// The lead warden: select-and-act rules over the lead record, no model. Each rule
// that holds on a lead keeps exactly one open Task for the lead's owner, and
// the Task is closed once the rule stops holding. The warden writes Tasks and their
// targets only: it never writes an Opportunity, so it never moves a stage.
//
// State is read back from the records each pass: a warden Task carries its rule in
// `wardenRule` and is linked to its lead, so "is one open already" is a lookup, not
// a memory. The only thing kept between runs is the sweep's page cursor.

import { LEAD_STAGES } from '../lead-record.ts';
import { linkKey, opportunitiesWithLink } from '../leads/log-lead';
import type { TwentyRest } from '../rest';
import { businessDaysBetween } from './business-days';

export const WARDEN_RULES = [
  { value: 'UNTRIAGED', label: 'Untriaged' },
  { value: 'PROPOSAL_QUIET', label: 'Proposal quiet' },
  { value: 'MISSING_BRAND_OR_SOURCE', label: 'Missing Brand or Source' },
  { value: 'DUPLICATE_LINK', label: 'Link logged twice' },
  { value: 'CLOSED_INCOMPLETE', label: 'Closed without Outcome or Scoping hours' },
] as const;
export type WardenRule = (typeof WARDEN_RULES)[number]['value'];

/** Business days a lead may sit untriaged, and a proposal may sit quiet, before a Task opens. */
export const UNTRIAGED_DAYS = 2;
export const QUIET_DAYS = 5;

export type WardenLead = {
  id: string;
  name?: string | null;
  stage?: string | null;
  triageVerdict?: string | null;
  outcome?: string | null;
  scopingHours?: number | null;
  source?: string | null;
  brandId?: string | null;
  ownerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sourceDetail?: { primaryLinkUrl?: string | null } | null;
  pointOfContact?: {
    emails?: { primaryEmail?: string | null } | null;
    phones?: { primaryPhoneNumber?: string | null } | null;
  } | null;
};

type Stamped = { createdAt?: string; updatedAt?: string };
type TaskRow = Stamped & { id?: string; status?: string | null; wardenRule?: string | null };

/** A rule holding on a lead: the Task title it opens, and when this spell of it began. */
export type Held = { rule: WardenRule; title: string; since: string };

const present = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const quoted = (lead: { name?: string | null; id: string }) => (lead.name ? `"${lead.name}"` : lead.id);
/** The newest of some timestamps, or '' when none parses. */
function latest(stamps: (string | undefined)[]): string {
  let best = '';
  let at = -Infinity;
  for (const s of stamps) {
    const t = Date.parse(s ?? '');
    if (t > at) [best, at] = [s!, t];
  }
  return best;
}

/** A channel we can send a follow-up from: the lead's point of contact has an email or a phone number. */
export function hasSendableChannel(lead: WardenLead): boolean {
  return present(lead.pointOfContact?.emails?.primaryEmail) || present(lead.pointOfContact?.phones?.primaryPhoneNumber);
}

/** Triaged once a verdict is saved or the lead has left New. */
export function isTriaged(lead: WardenLead): boolean {
  return present(lead.triageVerdict) || (present(lead.stage) && lead.stage !== LEAD_STAGES.NEW);
}

export type LeadContext = {
  /** The newest touch on the lead: its own edits, its notes, its Tasks other than the warden's. */
  lastTouch: string;
  /** The earlier lead holding the same link, when this one is the repeat. */
  earlier: { id: string; name: string; createdAt?: string } | null;
};

/**
 * The rules holding on one lead now. A closed lead is held to one rule only: it
 * carries its Outcome and Scoping hours, which rank channels by wins per hour.
 * Flagged, not refused: the client's close() may leave Scoping hours unset.
 */
export function heldRules(lead: WardenLead, ctx: LeadContext, now: Date): Held[] {
  const created = lead.createdAt ?? '';
  if (lead.stage === LEAD_STAGES.CLOSED) {
    const unset = [!present(lead.outcome) && 'Outcome', !Number.isFinite(lead.scopingHours ?? NaN) && 'Scoping hours'].filter(Boolean);
    return unset.length === 0 ? [] : [{ rule: 'CLOSED_INCOMPLETE', since: created, title: `Set ${unset.join(' and ')} on ${quoted(lead)}: it is Closed` }];
  }
  const held: Held[] = [];
  const age = (from: string) => businessDaysBetween(new Date(from), now);

  if (!isTriaged(lead) && age(created) > UNTRIAGED_DAYS) {
    held.push({ rule: 'UNTRIAGED', since: created, title: `Triage ${quoted(lead)}: untriaged for more than ${UNTRIAGED_DAYS} business days` });
  }
  if (lead.stage === LEAD_STAGES.PROPOSAL_OUT && hasSendableChannel(lead) && age(ctx.lastTouch) > QUIET_DAYS) {
    held.push({ rule: 'PROPOSAL_QUIET', since: ctx.lastTouch, title: `Follow up on ${quoted(lead)}: the proposal is quiet for more than ${QUIET_DAYS} business days` });
  }
  const missing = [!present(lead.brandId) && 'Brand', !present(lead.source) && 'Source'].filter(Boolean);
  if (missing.length > 0) {
    held.push({ rule: 'MISSING_BRAND_OR_SOURCE', since: created, title: `Set ${missing.join(' and ')} on ${quoted(lead)}` });
  }
  if (ctx.earlier) {
    held.push({
      rule: 'DUPLICATE_LINK',
      since: latest([created, ctx.earlier.createdAt]),
      title: `${quoted(lead)} repeats the link of ${quoted(ctx.earlier)}: keep one`,
    });
  }
  return held;
}

const BODY: Record<WardenRule, string> = {
  UNTRIAGED: 'Run the triage panel on this lead. This task closes itself once the lead is triaged.',
  PROPOSAL_QUIET: 'Nothing has happened on this lead since the proposal. Follow up, and log a note: the task closes itself on the next touch.',
  MISSING_BRAND_OR_SOURCE: 'Every lead carries its Brand and Source. This task closes itself once both are set.',
  DUPLICATE_LINK: 'The same posting is logged as two leads. Keep one; this task closes itself once the link is on one lead only.',
  CLOSED_INCOMPLETE: 'Channels are ranked by wins per scoping hour, so a closed lead carries how it ended and the hours spent scoping. This task closes itself once both are set.',
};

async function rows<T>(rest: TwentyRest, path: string, key: string): Promise<T[]> {
  const res = await rest<{ data?: Record<string, T[]> }>('GET', path);
  const list = res.data?.[key];
  return Array.isArray(list) ? list : [];
}

async function leadContext(lead: WardenLead, tasks: TaskRow[], rest: TwentyRest): Promise<LeadContext> {
  const touches = [lead.updatedAt, ...tasks.filter((t) => !t.wardenRule).map((t) => t.updatedAt ?? t.createdAt)];
  if (lead.stage === LEAD_STAGES.PROPOSAL_OUT && hasSendableChannel(lead)) {
    const filter = `targetOpportunityId[eq]:${encodeURIComponent(lead.id)}`;
    const notes = await rows<{ note?: Stamped | null }>(rest, `noteTargets?filter=${filter}&depth=1&limit=200`, 'noteTargets');
    touches.push(...notes.map((n) => n.note?.updatedAt ?? n.note?.createdAt));
  }
  let earlier: LeadContext['earlier'] = null;
  const key = linkKey(lead.sourceDetail?.primaryLinkUrl ?? '');
  if (key) {
    const mine = Date.parse(lead.createdAt ?? '');
    const before = (o: { id: string; createdAt?: string }) => {
      const theirs = Date.parse(o.createdAt ?? '');
      return theirs < mine || (theirs === mine && o.id < lead.id);
    };
    earlier = (await opportunitiesWithLink(key, rest)).filter((o) => o.id !== lead.id && before(o))[0] ?? null;
  }
  return { lastTouch: latest(touches), earlier };
}

export type Reconciled = { opened: WardenRule[]; closed: WardenRule[] };

/**
 * Brings one lead's warden Tasks in line with the rules holding on it: opens one
 * where a rule holds and none is open, closes every open one whose rule no longer
 * holds, and closes all but the oldest when a race left two open. A Task closed by
 * hand during the same spell of a rule is not reopened.
 */
export async function reconcileLead(lead: WardenLead, rest: TwentyRest, now: Date): Promise<Reconciled> {
  const filter = `targetOpportunityId[eq]:${encodeURIComponent(lead.id)}`;
  const targets = await rows<{ task?: TaskRow | null }>(rest, `taskTargets?filter=${filter}&depth=1&limit=200`, 'taskTargets');
  const tasks = targets.map((t) => t.task).filter((t): t is TaskRow => Boolean(t?.id));
  const held = new Map(heldRules(lead, await leadContext(lead, tasks, rest), now).map((h) => [h.rule, h]));
  const result: Reconciled = { opened: [], closed: [] };
  const close = async (task: TaskRow, rule: WardenRule) => {
    await rest('PATCH', `tasks/${encodeURIComponent(String(task.id))}`, { status: 'DONE' });
    result.closed.push(rule);
  };

  for (const { value: rule } of WARDEN_RULES) {
    const mine = tasks.filter((t) => t.wardenRule === rule).sort((a, b) => Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? ''));
    const open = mine.filter((t) => t.status !== 'DONE');
    const h = held.get(rule);
    for (const task of h ? open.slice(1) : open) await close(task, rule);
    const thisSpell = mine.some((t) => Date.parse(t.createdAt ?? '') >= Date.parse(h?.since ?? ''));
    if (h && open.length === 0 && !thisSpell) {
      await openTask(lead, h, rest);
      result.opened.push(rule);
    }
  }
  return result;
}

async function openTask(lead: WardenLead, held: Held, rest: TwentyRest): Promise<void> {
  const task: Record<string, unknown> = {
    title: held.title.slice(0, 250),
    status: 'TODO',
    wardenRule: held.rule,
    bodyV2: { markdown: BODY[held.rule] },
  };
  if (present(lead.ownerId)) task.assigneeId = lead.ownerId;
  const created = await rest<{ data?: Record<string, { id?: string }> }>('POST', 'tasks', task);
  const taskId = created.data?.createTask?.id;
  if (!taskId) throw new Error('task create returned no id');
  try {
    await rest('POST', 'taskTargets', { taskId, targetOpportunityId: lead.id });
  } catch (err) {
    // An unlinked task is invisible to the next pass, which would open another: close it.
    await rest('PATCH', `tasks/${encodeURIComponent(taskId)}`, { status: 'DONE' }).catch(() => undefined);
    throw err;
  }
}

/** One lead, read fresh by id: the record-event path. */
export async function reconcileLeadById(id: string, rest: TwentyRest, now: Date): Promise<Reconciled> {
  const res = await rest<{ data?: { opportunity?: WardenLead } }>('GET', `opportunities/${encodeURIComponent(id)}?depth=1`);
  if (!res.data?.opportunity) throw new Error('opportunity lookup returned no record');
  return reconcileLead(res.data.opportunity, rest, now);
}

/** Where the sweep resumes: Twenty's page cursor, null to start a new lap. */
export type CursorStore = { get(): Promise<string | null>; set(after: string | null): Promise<void> };

export type SweepResult = { leads: number; opened: number; closed: number; next: string | null };

/**
 * The cron path: one page of leads per run, open or closed without Outcome or
 * Scoping hours, resuming from the stored cursor
 * and starting a new lap after the last page, so age-based rules fire with no edit
 * to set them off. A lead that fails is named and the rest still run; the run then
 * fails, after the cursor is saved, so the failure shows without stalling the lap.
 */
export async function sweep(rest: TwentyRest, cursor: CursorStore, now: Date, pageSize = 30): Promise<SweepResult> {
  const after = await cursor.get();
  const filter = encodeURIComponent(`or(stage[neq]:${LEAD_STAGES.CLOSED},outcome[is]:NULL,scopingHours[is]:NULL)`);
  const res = await rest<{ data?: { opportunities?: WardenLead[] }; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } }>(
    'GET',
    `opportunities?filter=${filter}&depth=1&limit=${pageSize}${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`,
  );
  const leads = (res.data?.opportunities ?? []).filter((l) => l?.id);
  const result: SweepResult = { leads: leads.length, opened: 0, closed: 0, next: null };
  const failed: string[] = [];
  for (const lead of leads) {
    try {
      const r = await reconcileLead(lead, rest, now);
      result.opened += r.opened.length;
      result.closed += r.closed.length;
    } catch (err) {
      failed.push(`${lead.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  result.next = res.pageInfo?.hasNextPage && res.pageInfo.endCursor ? res.pageInfo.endCursor : null;
  await cursor.set(result.next);
  if (failed.length > 0) throw new Error(`lead warden: ${failed.length} lead(s) not reconciled: ${failed.join('; ')}`);
  return result;
}
