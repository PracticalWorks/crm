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

// Type PRODUCT_SIGNUP, by stage.
export default defineView({
  universalIdentifier: VIEWS.typeProductSignup,
  name: 'Product signups by stage',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconUserPlus',
  position: 5,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: '1f4d9f92-5a83-435a-a60c-b61f409551c5', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: 'abd8e156-147f-4927-8e96-7d2c3d85ede3', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: '93e7174a-db4e-4857-a93d-9205868cf73e', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: '96e2a619-b1ac-451c-b580-566d4fcfdc9f', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 3, isVisible: true },
    { universalIdentifier: '8e824e89-7b35-4dd4-aa2e-ad7c881d87a7', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.source, position: 4, isVisible: true },
    { universalIdentifier: '59f13602-d31d-4bde-abf9-3325ed8f8417', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
  groups: STAGE_GROUPS.typeProductSignup,
  filters: [
    {
      universalIdentifier: 'a91a6100-3984-443f-b208-ec63bd313a6d',
      fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType,
      operand: ViewFilterOperand.IS,
      value: ['PRODUCT_SIGNUP'],
    },
  ],
});
