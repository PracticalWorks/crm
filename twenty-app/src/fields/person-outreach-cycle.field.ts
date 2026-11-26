import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  OUTREACH_CYCLE_FIELDS,
  OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// The outreach cycle this person is enrolled in; the reverse side of OutreachCycle.people.
// Deleting the cycle leaves the person, unenrolled.
export default defineField({
  universalIdentifier: PERSON_OUTREACH_CYCLE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'outreachCycle',
  label: 'Outreach cycle',
  description: 'The outreach cycle this person is enrolled in.',
  icon: 'IconFlask',
  relationTargetObjectMetadataUniversalIdentifier: OUTREACH_CYCLE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: OUTREACH_CYCLE_FIELDS.people,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'outreachCycleId',
  },
});
