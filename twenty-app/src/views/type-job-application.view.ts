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

// Type JOB_APPLICATION, by stage.
export default defineView({
  universalIdentifier: VIEWS.typeJobApplication,
  name: 'Job applications by stage',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconFileCv',
  position: 4,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: 'c2bd9c9f-60aa-4556-bc4e-f0db25ad8676', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: '67c21c4d-cce5-4afc-a91f-9818d86f4c9b', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: 'cf12af9d-bc57-49bc-ad60-8aee8e15cd80', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: 'dc8ada60-b749-4ec3-809a-95e43f46c5e7', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 3, isVisible: true },
    { universalIdentifier: '2992aa2a-dcbe-431c-949b-d5a5b65366b1', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.source, position: 4, isVisible: true },
    { universalIdentifier: '79b8d212-ce22-4a90-a018-60a6917dcefc', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
  groups: STAGE_GROUPS.typeJobApplication,
  filters: [
    {
      universalIdentifier: 'f6bc2a69-b71c-4182-99a7-bc63b80dfb9a',
      fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType,
      operand: ViewFilterOperand.IS,
      value: ['JOB_APPLICATION'],
    },
  ],
});
