import { OUTREACH_STATES } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { PERSON_OUTREACH_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';
import { outreachFieldSpec } from './person-outreach-spec';

export default defineField({
  universalIdentifier: PERSON_OUTREACH_FIELDS.outreachState,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  ...outreachFieldSpec('outreachState'),
  options: selectOptions(OUTREACH_STATES),
});
