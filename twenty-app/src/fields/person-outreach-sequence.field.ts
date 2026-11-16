import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { PERSON_OUTREACH_FIELDS } from '../constants/universal-identifiers';
import { outreachFieldSpec } from './person-outreach-spec';

export default defineField({
  universalIdentifier: PERSON_OUTREACH_FIELDS.outreachSequence,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  ...outreachFieldSpec('outreachSequence'),
});
