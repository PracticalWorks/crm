import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  BRAND_FIELDS,
  BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_BRANDS_FIELD_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// The reverse side of Brand.owner. Twenty relations are declared on both objects.
export default defineField({
  universalIdentifier: WORKSPACE_MEMBER_BRANDS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'brandsOwned',
  label: 'Brands owned',
  icon: 'IconBuildingStore',
  relationTargetObjectMetadataUniversalIdentifier: BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: BRAND_FIELDS.owner,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
