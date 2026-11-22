import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { TRIAGE_OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { TRIAGE_CHECKS } from '../leads/triage';
import { selectOptions } from '../select-options';

// The checks answered yes; the others were answered no. Written by the triage panel.
export default defineField({
  universalIdentifier: TRIAGE_OPPORTUNITY_FIELDS.triageChecks,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.MULTI_SELECT,
  name: 'triageChecks',
  label: 'Triage checks met',
  description: 'Which of fit, price, leverage, access and buyer were a yes at triage. Set with the verdict.',
  icon: 'IconChecklist',
  options: selectOptions(TRIAGE_CHECKS),
});
