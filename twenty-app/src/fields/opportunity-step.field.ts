import { LEAD_STEPS } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.step,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'step',
  label: 'Step',
  description: 'A finer step inside the stage, where an app works one.',
  icon: 'IconStairs',
  options: selectOptions(LEAD_STEPS),
});
