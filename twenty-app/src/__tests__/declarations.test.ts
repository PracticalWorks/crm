import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as ids from '../constants/universal-identifiers';

const SRC = join(__dirname, '..');

function allIds(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allIds);
  return [];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__tests__' ? [] : sourceFiles(join(dir, e.name))) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('the app declarations', () => {
  it('use distinct, well-formed universal identifiers everywhere', () => {
    const literal = sourceFiles(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/g)].map((m) => m[1]!),
    );
    const every = [...new Set([...allIds(ids), ...literal])];
    expect(literal.length).toBe(new Set(literal).size);
    for (const id of every) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('never name a field Twenty reserves (type, links)', () => {
    const names = sourceFiles(SRC).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bname: '([A-Za-z]+)'/g)].map((m) => m[1]));
    expect(names).not.toContain('type');
    expect(names).not.toContain('links');
  });

  it('never declare the standard stage field, which an app cannot own', () => {
    const text = sourceFiles(join(SRC, 'fields')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(text).not.toMatch(/name: 'stage'/);
  });
});
