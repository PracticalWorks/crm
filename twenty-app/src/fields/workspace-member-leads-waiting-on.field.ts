import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS, WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';

// The reverse side of Opportunity.waitingOn. Twenty relations are declared on both objects.
export default defineField({
  universalIdentifier: WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'leadsWaitingOn',
  label: 'Leads waiting on them',
  icon: 'IconHourglass',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOn,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
