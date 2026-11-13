import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.sourceDetail,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.LINKS,
  name: 'sourceDetail',
  label: 'Source detail',
  description: 'The posting, card or lead the opportunity came from.',
  icon: 'IconLink',
});
