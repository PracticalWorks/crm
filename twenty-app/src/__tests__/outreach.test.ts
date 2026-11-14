import { describe, expect, it } from 'vitest';

import { OUTREACH_PERSON_FIELDS, OUTREACH_STATES } from '../lead-record.ts';
import { PERSON_OUTREACH_FIELDS, VIEWS } from '../constants/universal-identifiers';
import sequence from '../fields/person-outreach-sequence.field';
import step from '../fields/person-outreach-step.field';
import lastSentAt from '../fields/person-outreach-last-sent-at.field';
import state from '../fields/person-outreach-state.field';
import outreachView from '../views/outreach.view';

// defineField / defineView return their manifest as `config` (or as-is on older SDKs).
const manifest = (d: unknown): any => (d as any)?.config ?? d;

describe('the outreach Person fields', () => {
  const declared = [sequence, step, lastSentAt, state].map(manifest);

  it('declares exactly the fields frontdesk checks for, with the same names and types', () => {
    expect(declared.map((f) => [f.name, String(f.type)])).toEqual(OUTREACH_PERSON_FIELDS.map((f) => [f.name, f.type]));
  });

  it('puts every one on Person under its own stable identifier', () => {
    for (const f of declared) {
      expect(f.universalIdentifier).toBe(PERSON_OUTREACH_FIELDS[f.name as keyof typeof PERSON_OUTREACH_FIELDS]);
    }
  });

  it('offers every outreach state frontdesk can write', () => {
    expect(manifest(state).options.map((o: { value: string }) => o.value)).toEqual(OUTREACH_STATES.map((o) => o.value));
  });

  it('the Outreach view lists only emailed people, newest send first', () => {
    const v = manifest(outreachView);
    expect(v.universalIdentifier).toBe(VIEWS.outreach);
    expect(v.filters).toEqual([expect.objectContaining({ fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachSequence, operand: 'IS_NOT_EMPTY' })]);
    expect(v.sorts).toEqual([expect.objectContaining({ fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachLastSentAt, direction: 'DESC' })]);
    const shown = v.fields.map((f: { fieldMetadataUniversalIdentifier: string }) => f.fieldMetadataUniversalIdentifier);
    for (const id of Object.values(PERSON_OUTREACH_FIELDS)) expect(shown).toContain(id);
  });
});
