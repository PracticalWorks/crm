import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { OUTREACH_CYCLE_VERDICTS } from '../lead-record.ts';
import {
  BRAND_FIELDS,
  BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_FIELDS,
  OUTREACH_CYCLE_FIELDS,
  OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';
import brand from '../objects/brand.object';
import cycle from '../objects/outreach-cycle.object';
import personCycle from '../fields/person-outreach-cycle.field';
import opportunityCycle from '../fields/opportunity-outreach-cycle.field';

// defineObject / defineField return their manifest as `config` (or as-is on older SDKs).
const manifest = (d: unknown): any => (d as any)?.config ?? d;
const PERSON = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier;
const OPPORTUNITY = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier;
const object = manifest(cycle);
const field = (name: string) => object.fields.find((f: { name: string }) => f.name === name);

describe('the Outreach cycle object', () => {
  it('is its own object under a stable identifier', () => {
    expect(object).toMatchObject({ universalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER, nameSingular: 'outreachCycle', namePlural: 'outreachCycles' });
  });

  it('carries the audience, hook, ask, dates and keep-or-kill verdict', () => {
    expect(object.fields.map((f: { name: string; type: string; universalIdentifier: string }) => [f.name, String(f.type), f.universalIdentifier])).toEqual(
      expect.arrayContaining([
        ['audience', 'TEXT', OUTREACH_CYCLE_FIELDS.audience],
        ['hook', 'TEXT', OUTREACH_CYCLE_FIELDS.hook],
        ['ask', 'TEXT', OUTREACH_CYCLE_FIELDS.ask],
        ['startDate', 'DATE', OUTREACH_CYCLE_FIELDS.startDate],
        ['endDate', 'DATE', OUTREACH_CYCLE_FIELDS.endDate],
        ['verdict', 'SELECT', OUTREACH_CYCLE_FIELDS.verdict],
      ]),
    );
    expect(field('verdict').options.map((o: { value: string }) => o.value)).toEqual(OUTREACH_CYCLE_VERDICTS.map((o) => o.value));
    expect(OUTREACH_CYCLE_VERDICTS.map((o) => o.value)).toEqual(['KEEP', 'KILL']);
  });

  it('belongs to a Brand, and the Brand lists its cycles', () => {
    expect(field('brand')).toMatchObject({
      universalIdentifier: OUTREACH_CYCLE_FIELDS.brand,
      type: 'RELATION',
      relationTargetObjectMetadataUniversalIdentifier: BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: BRAND_FIELDS.outreachCycles,
      universalSettings: { relationType: 'MANY_TO_ONE', onDelete: 'SET_NULL', joinColumnName: 'brandId' },
    });
    expect(manifest(brand).fields.find((f: { name: string }) => f.name === 'outreachCycles')).toMatchObject({
      universalIdentifier: BRAND_FIELDS.outreachCycles,
      type: 'RELATION',
      relationTargetObjectMetadataUniversalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: OUTREACH_CYCLE_FIELDS.brand,
      universalSettings: { relationType: 'ONE_TO_MANY' },
    });
  });
});

describe('the cycle to Person relation: its enrolled People', () => {
  it('lists the People on the cycle', () => {
    expect(field('people')).toMatchObject({
      universalIdentifier: OUTREACH_CYCLE_FIELDS.people,
      type: 'RELATION',
      relationTargetObjectMetadataUniversalIdentifier: PERSON,
      relationTargetFieldMetadataUniversalIdentifier: PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: { relationType: 'ONE_TO_MANY' },
    });
  });

  it('names the cycle on each Person, and clears it when the cycle is deleted', () => {
    expect(manifest(personCycle)).toMatchObject({
      universalIdentifier: PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: PERSON,
      type: 'RELATION',
      name: 'outreachCycle',
      relationTargetObjectMetadataUniversalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: OUTREACH_CYCLE_FIELDS.people,
      universalSettings: { relationType: 'MANY_TO_ONE', onDelete: 'SET_NULL', joinColumnName: 'outreachCycleId' },
    });
  });
});

describe('the cycle to Opportunity relation: its positive replies and calls booked', () => {
  it('lists the Opportunities the cycle opened', () => {
    expect(field('opportunities')).toMatchObject({
      universalIdentifier: OUTREACH_CYCLE_FIELDS.opportunities,
      type: 'RELATION',
      relationTargetObjectMetadataUniversalIdentifier: OPPORTUNITY,
      relationTargetFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.outreachCycle,
      universalSettings: { relationType: 'ONE_TO_MANY' },
    });
  });

  it('names the cycle on each Opportunity, and clears it when the cycle is deleted', () => {
    expect(manifest(opportunityCycle)).toMatchObject({
      universalIdentifier: OPPORTUNITY_FIELDS.outreachCycle,
      objectUniversalIdentifier: OPPORTUNITY,
      type: 'RELATION',
      name: 'outreachCycle',
      relationTargetObjectMetadataUniversalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: OUTREACH_CYCLE_FIELDS.opportunities,
      universalSettings: { relationType: 'MANY_TO_ONE', onDelete: 'SET_NULL', joinColumnName: 'outreachCycleId' },
    });
  });
});
