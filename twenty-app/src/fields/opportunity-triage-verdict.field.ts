import { TRIAGE_VERDICTS } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.triageVerdict,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'triageVerdict',
  label: 'Triage verdict',
  description: 'Work, pass or defer. A pass gives its reason in Pass reason.',
  icon: 'IconGavel',
  options: selectOptions(TRIAGE_VERDICTS),
});
