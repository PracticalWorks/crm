import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  OPPORTUNITY_FIELDS,
  OUTREACH_CYCLE_FIELDS,
  OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// The outreach cycle whose email won this reply; the reverse side of
// OutreachCycle.opportunities. Deleting the cycle leaves the lead.
export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.outreachCycle,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'outreachCycle',
  label: 'Outreach cycle',
  description: 'The outreach cycle this positive reply came from.',
  icon: 'IconFlask',
  relationTargetObjectMetadataUniversalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: OUTREACH_CYCLE_FIELDS.opportunities,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'outreachCycleId',
  },
});
