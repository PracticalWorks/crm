import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { TRIAGE_OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { FULL_SCOPES } from '../leads/triage';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: TRIAGE_OPPORTUNITY_FIELDS.fullScope,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'fullScope',
  label: 'Full scope',
  description: 'Set when a full scope starts: cold if the lead had not reached Engaged. Empty means no full scope yet.',
  icon: 'IconRuler',
  options: selectOptions(FULL_SCOPES),
});
