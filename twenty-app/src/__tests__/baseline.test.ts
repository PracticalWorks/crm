import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import baseline from '../../baseline/workspace-custom-fields.json';

const SRC = join(__dirname, '..');

function sourceText(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? (e.name === '__tests__' ? '' : sourceText(join(dir, e.name))) : readFileSync(join(dir, e.name), 'utf8')))
    .join('\n');
}

// The custom fields writers depend on today (Person lane and source, the Company
// fields) belong to the workspace's own custom application. An app sync only
// touches what that app owns, so this app cannot prune them; these checks keep it
// from ever claiming one either.
describe('the existing workspace custom fields', () => {
  const text = sourceText(SRC);

  it('were captured before the first apply', () => {
    const names = baseline.fields.map((f) => `${f.object}.${f.name}`);
    for (const wanted of ['person.lane', 'person.source', 'person.workspaceCustom', 'company.relationshipType', 'company.billing', 'company.vendorCategory']) {
      expect(names).toContain(wanted);
    }
  });

  it('are never referenced by this app', () => {
    for (const field of baseline.fields) expect(text).not.toContain(field.universalIdentifier);
  });

  it('never share a name with a field this app adds to the same object', () => {
    const fieldsDir = join(SRC, 'fields');
    for (const file of readdirSync(fieldsDir)) {
      const src = readFileSync(join(fieldsDir, file), 'utf8');
      const name = src.match(/\bname: '([A-Za-z]+)'/)?.[1];
      const object = src.match(/STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS\.(\w+)\.universalIdentifier,\n\s+type:/)?.[1]
        ?? src.match(/objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS\.(\w+)/)?.[1]
        ?? 'opportunity';
      expect(baseline.fields.some((f) => f.object === object && f.name === name)).toBe(false);
    }
  });
});
