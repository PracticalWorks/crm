// The 10-minute screen every lead gets before scoping: five yes/no checks, the
// Brand's floor rate for the lead's Type, and a verdict saved in one update. Also
// where a full scope starts: allowed at any stage, but one started before Engaged
// is marked cold, so the data shows it. The rules live here, behind the routes;
// the panel only collects and shows.

import { LEAD_STAGES, LEAD_TYPES, TRIAGE_VERDICTS, type LeadType } from '../lead-record.ts';
import type { TwentyRest } from '../rest';

/** The five checks, in the lead plan's order. A no to any one is normally a pass. */
export const TRIAGE_CHECKS = [
  { value: 'FIT', label: 'Fit', question: 'A real codebase, or a decision a senior engineer can settle.' },
  { value: 'PRICE', label: 'Price', question: 'The likely number clears the floor in human hours.' },
  { value: 'LEVERAGE', label: 'Leverage', question: 'Agents can compress most of the work.' },
  { value: 'ACCESS', label: 'Access', question: 'We can ask the buyer a question before proposing.' },
  { value: 'BUYER', label: 'Buyer', question: 'A founder or owner decides, not a scored procurement.' },
] as const;
export type TriageCheck = (typeof TRIAGE_CHECKS)[number]['value'];

/** How a full scope started. Empty means none has. */
export const FULL_SCOPES = [
  { value: 'COLD', label: 'Cold: started before Engaged' },
  { value: 'WARM', label: 'Warm: started at Engaged or later' },
] as const;
export type FullScope = (typeof FULL_SCOPES)[number]['value'];

/** The Brand field holding a Type's floor rate: PROJECT → floorRateProject. */
export function floorRateFieldName(type: LeadType): string {
  return `floorRate${type.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase())}`;
}

/** The Opportunity as the panel and the routes read it. */
export type TriageOpportunity = {
  id: string;
  name?: string;
  stage?: string | null;
  leadType?: string | null;
  triageChecks?: string[] | null;
  triageVerdict?: string | null;
  passReason?: string | null;
  fullScope?: string | null;
  brand?: ({ name?: string } & Record<string, unknown>) | null;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The floor rate the lead's Brand sets for the lead's Type, or what is missing. */
export function floorRate(o: TriageOpportunity): { rate: string } | { missing: string } {
  const type = LEAD_TYPES.find((t) => t.value === o.leadType);
  if (!o.brand) return { missing: 'This lead has no Brand, so it has no floor rate.' };
  if (!type) return { missing: 'This lead has no Type, so it has no floor rate.' };
  const rate = text(o.brand[floorRateFieldName(type.value)]);
  return rate ? { rate } : { missing: `No floor rate is set on ${o.brand.name ?? 'its Brand'} for ${type.label}.` };
}

const BEFORE_ENGAGED: readonly string[] = [LEAD_STAGES.NEW, LEAD_STAGES.TRIAGED, LEAD_STAGES.LIGHT_REPLY_SENT];

/** A lead with no stage, or at New, Triaged or Light reply sent, has not engaged. */
export function isBeforeEngaged(stage: string | null | undefined): boolean {
  return !stage || BEFORE_ENGAGED.includes(stage);
}

async function getOpportunity(id: string, rest: TwentyRest): Promise<TriageOpportunity> {
  const res = await rest<{ data?: { opportunity?: TriageOpportunity } }>('GET', `opportunities/${encodeURIComponent(id)}`);
  if (!res.data?.opportunity) throw new Error('opportunity lookup returned no record');
  return res.data.opportunity;
}

const input = (raw: unknown) => (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
const VERDICTS: readonly string[] = TRIAGE_VERDICTS.map((v) => v.value);

export type TriageResult =
  | { status: 'triaged'; opportunity: { id: string; name: string; stage: string | null } }
  | { status: 'invalid'; errors: string[] };

/**
 * Saves `{ opportunityId, checks: { FIT: true, ... }, verdict, passReason? }` in one
 * update: the checks answered yes, the verdict, and the pass reason (cleared unless
 * it is a pass). A New lead moves to Triaged; one already further keeps its stage.
 */
export async function triageLead(raw: unknown, rest: TwentyRest): Promise<TriageResult> {
  const body = input(raw);
  const checks = input(body.checks);
  const verdict = text(body.verdict);
  const passReason = text(body.passReason);
  const errors: string[] = [];
  if (!text(body.opportunityId)) errors.push('opportunityId is required');
  for (const c of TRIAGE_CHECKS) if (typeof checks[c.value] !== 'boolean') errors.push(`answer ${c.label} yes or no`);
  if (!VERDICTS.includes(verdict)) errors.push('verdict must be work, pass or defer');
  else if (verdict === 'PASS' && !passReason) errors.push('a pass needs its pass reason');
  if (errors.length > 0) return { status: 'invalid', errors };

  const id = text(body.opportunityId);
  const current = await getOpportunity(id, rest);
  const stage = current.stage === LEAD_STAGES.NEW ? LEAD_STAGES.TRIAGED : null;
  await rest('PATCH', `opportunities/${encodeURIComponent(id)}`, {
    triageChecks: TRIAGE_CHECKS.filter((c) => checks[c.value] === true).map((c) => c.value),
    triageVerdict: verdict,
    passReason: verdict === 'PASS' ? passReason : '',
    ...(stage && { stage }),
  });
  return { status: 'triaged', opportunity: { id, name: current.name ?? '', stage: stage ?? current.stage ?? null } };
}

export type StartScopeResult = { status: 'started' | 'already'; fullScope: FullScope } | { status: 'invalid'; errors: string[] };

/** Starts a full scope on `{ opportunityId }`: never refused, marked cold before Engaged. The first mark stays. */
export async function startScope(raw: unknown, rest: TwentyRest): Promise<StartScopeResult> {
  const id = text(input(raw).opportunityId);
  if (!id) return { status: 'invalid', errors: ['opportunityId is required'] };
  const current = await getOpportunity(id, rest);
  if (current.fullScope === 'COLD' || current.fullScope === 'WARM') return { status: 'already', fullScope: current.fullScope };
  const fullScope: FullScope = isBeforeEngaged(current.stage) ? 'COLD' : 'WARM';
  await rest('PATCH', `opportunities/${encodeURIComponent(id)}`, { fullScope });
  return { status: 'started', fullScope };
}
