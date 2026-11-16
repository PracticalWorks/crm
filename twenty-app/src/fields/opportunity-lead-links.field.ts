import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.leadLinks,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.LINKS,
  name: 'leadLinks',
  label: 'Links',
  description: 'Live pages in the app that owns the lead: posting, app page, documents. Named leadLinks because Twenty reserves the field name links.',
  icon: 'IconLinks',
});
