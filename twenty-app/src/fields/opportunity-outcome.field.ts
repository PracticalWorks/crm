import { LEAD_OUTCOMES } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.outcome,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'outcome',
  label: 'Outcome',
  description: 'How the lead ended. Set when it reaches Closed.',
  icon: 'IconFlag',
  options: selectOptions(LEAD_OUTCOMES),
});
