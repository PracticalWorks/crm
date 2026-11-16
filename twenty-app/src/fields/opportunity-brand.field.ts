import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { BRAND_FIELDS, BRAND_OBJECT_UNIVERSAL_IDENTIFIER, OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';

// Which brand the lead is for. Deleting a brand leaves its leads, unbranded.
export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.brand,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'brand',
  label: 'Brand',
  icon: 'IconBuildingStore',
  relationTargetObjectMetadataUniversalIdentifier: BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: BRAND_FIELDS.opportunities,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'brandId',
  },
});
