import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  BRAND_FIELDS,
  BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_FIELDS,
  OUTREACH_CYCLE_FIELDS,
  OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';
import { OUTREACH_CYCLE_VERDICTS } from '../lead-record.ts';
import { selectOptions } from '../select-options';

// One outreach experiment, about two weeks: who it targets, the hook and the ask,
// and at its end whether to keep it. Its People are the targets enrolled in it; its
// Opportunities are the positive replies, opened only on a reply, never on a cold
// target. A call booked is one of those Opportunities at Engaged or later: the
// app marks a booked call by stage, not by a field of its own.
export default defineObject({
  universalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'outreachCycle',
  namePlural: 'outreachCycles',
  labelSingular: 'Outreach cycle',
  labelPlural: 'Outreach cycles',
  description: 'A two-week outreach experiment: its audience, hook and ask, the People enrolled and the replies it won.',
  icon: 'IconFlask',
  fields: [
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.audience,
      name: 'audience',
      type: FieldType.TEXT,
      label: 'Audience',
      description: 'Who the cycle targets.',
      icon: 'IconUsersGroup',
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.hook,
      name: 'hook',
      type: FieldType.TEXT,
      label: 'Hook',
      description: 'The opening line or angle the emails lead with.',
      icon: 'IconBulb',
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.ask,
      name: 'ask',
      type: FieldType.TEXT,
      label: 'Ask',
      description: 'What a reply is asked for, e.g. a 20-minute call.',
      icon: 'IconMessageQuestion',
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.brand,
      name: 'brand',
      type: FieldType.RELATION,
      label: 'Brand',
      description: 'The brand the cycle runs for.',
      icon: 'IconBuildingStore',
      relationTargetObjectMetadataUniversalIdentifier: BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: BRAND_FIELDS.outreachCycles,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'brandId',
      },
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.startDate,
      name: 'startDate',
      type: FieldType.DATE,
      label: 'Start date',
      icon: 'IconCalendarEvent',
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.endDate,
      name: 'endDate',
      type: FieldType.DATE,
      label: 'End date',
      icon: 'IconCalendarCheck',
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.verdict,
      name: 'verdict',
      type: FieldType.SELECT,
      label: 'Verdict',
      description: 'Keep or kill, decided when the cycle ends. Empty until then.',
      icon: 'IconGavel',
      options: selectOptions(OUTREACH_CYCLE_VERDICTS),
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.people,
      name: 'people',
      type: FieldType.RELATION,
      label: 'Enrolled people',
      icon: 'IconUsers',
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: OUTREACH_CYCLE_FIELDS.opportunities,
      name: 'opportunities',
      type: FieldType.RELATION,
      label: 'Replies and calls booked',
      description: 'The positive replies. Those at Engaged or later are calls booked.',
      icon: 'IconTargetArrow',
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.outreachCycle,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
