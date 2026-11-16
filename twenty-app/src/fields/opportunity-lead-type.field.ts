import { LEAD_TYPES } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.leadType,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'leadType',
  label: 'Type',
  description: 'Project, contract seat, job application, product signup or partner. Named leadType because Twenty reserves the field name type.',
  icon: 'IconCategory',
  options: selectOptions(LEAD_TYPES),
});
