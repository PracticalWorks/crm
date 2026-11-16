import {
  AggregateOperations,
  defineView,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterOperand,
  ViewType,
} from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS, VIEWS } from '../constants/universal-identifiers';
import { STAGE_GROUPS } from './stage-groups';

const OPPORTUNITY = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity;

// Type PARTNER, by stage.
export default defineView({
  universalIdentifier: VIEWS.typePartner,
  name: 'Partners by stage',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconHeartHandshake',
  position: 6,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: '5004a56d-90b5-43c7-b9eb-6073640c44f3', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: '875b8a70-efbd-419e-b9d5-db97668de346', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: '805babc0-b56c-4927-8136-dee5d0f28c0e', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: '28088f37-83bc-437e-b2b8-8882e9751ae7', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 3, isVisible: true },
    { universalIdentifier: '88ec7bf4-c49d-41d2-9326-97ac031e53d2', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.source, position: 4, isVisible: true },
    { universalIdentifier: 'e061e64d-71a1-4d88-a1c7-498346576033', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
  groups: STAGE_GROUPS.typePartner,
  filters: [
    {
      universalIdentifier: '499f5ba8-fc16-4840-8e28-df2a5e6a5164',
      fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType,
      operand: ViewFilterOperand.IS,
      value: ['PARTNER'],
    },
  ],
});
