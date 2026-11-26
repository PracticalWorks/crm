import { defineView, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS, ViewFilterOperand, ViewType } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS, VIEWS } from '../constants/universal-identifiers';

const OPPORTUNITY = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity;

// Every lead waiting on a teammate, across channels, with the draft to open.
// Visibility only: each draft is still approved in its own channel.
export default defineView({
  universalIdentifier: VIEWS.waitingOnUs,
  name: 'Waiting on us',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconHourglass',
  position: 7,
  fields: [
    { universalIdentifier: 'ece54522-7743-48b8-9195-5d1660d87d12', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: '86b2a713-2d56-4d41-9981-562a8beb40ba', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOn, position: 1, isVisible: true },
    { universalIdentifier: 'ef7c07ac-c5bd-4cae-a81e-6505ff7b23af', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOnDraft, position: 2, isVisible: true },
    { universalIdentifier: '7d70ab85-d1a7-46f7-8f0f-d75d42fb95bc', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOnChannel, position: 3, isVisible: true },
    { universalIdentifier: '21e921da-85c0-42ee-a4ba-161210ef9b42', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 4, isVisible: true },
    { universalIdentifier: '5ab13dd9-34fa-4d30-af50-f345d7006e29', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier, position: 5, isVisible: true },
  ],
  filters: [
    {
      universalIdentifier: 'd66653e1-8d6b-4d05-bb23-c2d8739f5c6d',
      fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOn,
      operand: ViewFilterOperand.IS_NOT_EMPTY,
      value: '',
    },
  ],
});
