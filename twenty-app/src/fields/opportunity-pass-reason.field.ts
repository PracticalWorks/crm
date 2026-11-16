import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.passReason,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.TEXT,
  name: 'passReason',
  label: 'Pass reason',
  description: 'Why the lead was passed.',
  icon: 'IconMessageX',
});
