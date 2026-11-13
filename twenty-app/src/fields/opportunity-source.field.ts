import { LEAD_SOURCES } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.source,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'source',
  label: 'Source',
  description: 'Where the lead came from.',
  icon: 'IconInbox',
  options: selectOptions(LEAD_SOURCES),
});
