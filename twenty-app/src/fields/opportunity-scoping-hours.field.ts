import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.scopingHours,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.NUMBER,
  name: 'scopingHours',
  label: 'Scoping hours',
  description: 'Hours spent scoping, logged at close.',
  icon: 'IconClock',
  universalSettings: { dataType: 'float', decimals: 1 },
});
