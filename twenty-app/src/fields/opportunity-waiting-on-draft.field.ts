import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.waitingOnDraft,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.LINKS,
  name: 'waitingOnDraft',
  label: 'Waiting-on draft',
  description: 'The draft waiting for approval, where it is approved.',
  icon: 'IconFileText',
});
