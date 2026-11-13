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

// Type CONTRACT_SEAT, by stage.
export default defineView({
  universalIdentifier: VIEWS.typeContractSeat,
  name: 'Contract seats by stage',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconUserDollar',
  position: 3,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: '52c48d9b-2684-4b6d-a8d1-335851fda1cc', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: 'fb6164ac-bc09-452c-b2a6-d3c51c0dc9f8', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: '66eb29ca-501d-42bc-89a7-80344d4c863a', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: '87f083a9-05ff-448d-8a0f-12aa6f6f1509', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 3, isVisible: true },
    { universalIdentifier: 'ebabd6d6-0b2a-4f66-8128-751954ad3d14', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.source, position: 4, isVisible: true },
    { universalIdentifier: 'defd455f-5ea0-4acc-b94f-b20ee4f72a4a', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
  groups: STAGE_GROUPS.typeContractSeat,
  filters: [
    {
      universalIdentifier: '4ff4c10f-b48e-4065-aa27-92877106f82e',
      fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType,
      operand: ViewFilterOperand.IS,
      value: ['CONTRACT_SEAT'],
    },
  ],
});
