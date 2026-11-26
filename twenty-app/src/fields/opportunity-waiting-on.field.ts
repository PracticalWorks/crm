import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS, WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';

// The teammate whose approval the lead waits on; empty when it waits on nobody.
// Set and cleared by the app that posted the draft. Removing the teammate clears it.
export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.waitingOn,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'waitingOn',
  label: 'Waiting on',
  description: 'The teammate whose approval this lead waits on. Empty when it waits on nobody.',
  icon: 'IconHourglass',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'waitingOnId',
  },
});
