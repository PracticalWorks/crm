import { OUTREACH_PERSON_FIELDS, type OutreachPersonFieldName } from '../lead-record.ts';

// Name, label, description and icon of one outreach Person field, from the client's
// list, so the field declared here and the one frontdesk checks for cannot drift.
export function outreachFieldSpec(name: OutreachPersonFieldName) {
  const spec = OUTREACH_PERSON_FIELDS.find((f) => f.name === name)!;
  return { name: spec.name, label: spec.label, description: spec.description, icon: spec.icon };
}
