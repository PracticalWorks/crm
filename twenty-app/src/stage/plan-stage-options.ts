import { LEAD_STAGE_LABELS, LEAD_STAGES, type LeadStageName } from '../lead-record.ts';

// Opportunity.stage is a STANDARD field, owned by Twenty itself, so an app cannot
// declare it: an app sync only creates, updates and deletes what that app owns.
// Its options change through the metadata API instead, with this plan.
//
// The plan never renames a value and never drops an option. Twenty stores a select
// as a Postgres enum and rebuilds it from the new option list on every options
// update: rows follow an option by its id, but a value that leaves the list leaves
// the enum, and every writer still sending it is refused from then on. So the live
// values stay (MEETING, PROPOSAL, CUSTOMER are written today), each keeps its id,
// the labels become the six shared stages, and LIGHT_REPLY_SENT is added.

export type StageOption = {
  id?: string;
  value: string;
  label: string;
  position: number;
  color?: string | null;
};

const PIPELINE: readonly LeadStageName[] = ['NEW', 'TRIAGED', 'LIGHT_REPLY_SENT', 'ENGAGED', 'PROPOSAL_OUT', 'CLOSED'];

export type StageChange =
  | { kind: 'relabel'; value: string; from: string; to: string }
  | { kind: 'move'; value: string; from: number; to: number }
  | { kind: 'add'; value: string; label: string; position: number };

export type StagePlan = { options: StageOption[]; changes: StageChange[] };

/**
 * The full option list to send (Twenty replaces the list, so every option is
 * sent, each with its id) and what differs from `current`. Options outside the six
 * stages are kept, after them, untouched.
 */
export function planStageOptions(current: readonly StageOption[]): StagePlan {
  const byValue = new Map(current.map((o) => [o.value, o]));
  const changes: StageChange[] = [];
  const options: StageOption[] = [];

  PIPELINE.forEach((name, position) => {
    const value = LEAD_STAGES[name];
    const label = LEAD_STAGE_LABELS[name];
    const existing = byValue.get(value);
    if (!existing) {
      if (name !== 'LIGHT_REPLY_SENT') {
        // A live stage value is missing: someone changed the field by hand. Adding it
        // back would not bring back the rows that held it, so stop and let a person look.
        throw new Error(`stage option ${value} is missing from the workspace; refusing to plan around it`);
      }
      options.push({ value, label, position, color: 'sky' });
      changes.push({ kind: 'add', value, label, position });
      return;
    }
    if (existing.label !== label) changes.push({ kind: 'relabel', value, from: existing.label, to: label });
    if (existing.position !== position) changes.push({ kind: 'move', value, from: existing.position, to: position });
    options.push({ ...existing, label, position });
  });

  const known = new Set(options.map((o) => o.value));
  const rest = current.filter((o) => !known.has(o.value)).sort((a, b) => a.position - b.position);
  rest.forEach((o, i) => {
    const position = PIPELINE.length + i;
    if (o.position !== position) changes.push({ kind: 'move', value: o.value, from: o.position, to: position });
    options.push({ ...o, position });
  });

  return { options, changes };
}
