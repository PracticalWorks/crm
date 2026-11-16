import { defineView, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS, ViewFilterOperand, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import { PERSON_OUTREACH_FIELDS, VIEWS } from '../constants/universal-identifiers';

const PERSON = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person;

// Everyone frontdesk's outreach has emailed, newest send first, with where each one
// is in their sequence. Visibility only: sending stays in frontdesk.
export default defineView({
  universalIdentifier: VIEWS.outreach,
  name: 'Outreach',
  objectUniversalIdentifier: PERSON.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconMailForward',
  position: 1,
  fields: [
    { universalIdentifier: '832811ce-a985-47f5-9300-d4beba29d70a', fieldMetadataUniversalIdentifier: PERSON.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: '511e771c-0df9-493d-91df-8cb325cf87c3', fieldMetadataUniversalIdentifier: PERSON.fields.emails.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: '394178c7-d53c-4961-a296-f8825f28ac57', fieldMetadataUniversalIdentifier: PERSON.fields.company.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: '236be7e0-3cea-4e24-befd-b0b46ed815ea', fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachSequence, position: 3, isVisible: true },
    { universalIdentifier: 'f24f8738-57cc-4715-8cdd-1de491c37326', fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachState, position: 4, isVisible: true },
    { universalIdentifier: '6ae0aeed-b5fa-469f-ad9e-bcaedf9ad392', fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachStep, position: 5, isVisible: true },
    { universalIdentifier: '7e43fba3-68a8-4840-a989-ba1abf7cd05c', fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachLastSentAt, position: 6, isVisible: true },
  ],
  filters: [
    {
      universalIdentifier: '12cdb7a4-e59c-423a-b98a-afc7ea8d017b',
      fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachSequence,
      operand: ViewFilterOperand.IS_NOT_EMPTY,
      value: '',
    },
  ],
  sorts: [
    {
      universalIdentifier: '8b142ff8-8ab6-4607-8593-97557e91bdfb',
      fieldMetadataUniversalIdentifier: PERSON_OUTREACH_FIELDS.outreachLastSentAt,
      direction: ViewSortDirection.DESC,
    },
  ],
});
