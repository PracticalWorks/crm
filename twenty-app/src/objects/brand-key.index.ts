import { defineIndex } from 'twenty-sdk/define';

import {
  BRAND_FIELDS,
  BRAND_KEY_UNIQUE_INDEX_FIELD_UNIVERSAL_IDENTIFIER,
  BRAND_KEY_UNIQUE_INDEX_UNIVERSAL_IDENTIFIER,
  BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// One brand per roster key: the seed upserts by it, so a duplicate would split a
// brand's leads across two records.
export default defineIndex({
  universalIdentifier: BRAND_KEY_UNIQUE_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: BRAND_KEY_UNIQUE_INDEX_FIELD_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier: BRAND_FIELDS.key,
    },
  ],
});
