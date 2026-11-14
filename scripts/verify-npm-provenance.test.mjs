import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNpmProvenance } from './verify-npm-provenance.mjs';

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

test('rejects a registry 404 instead of treating it as provenance', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(404, '{"error":"Not found"}');
  try {
    await assert.rejects(
      verifyNpmProvenance('@practicalworks/crm', '0.9.0'),
      /registry returned HTTP 404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects a successful response without provenance', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(200, '{}');
  try {
    await assert.rejects(
      verifyNpmProvenance('@practicalworks/crm', '0.9.0'),
      /no provenance attestation/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts a provenance predicate from the registry', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(200, JSON.stringify({
    provenance: { predicateType: 'https://slsa.dev/provenance/v1' },
  }));
  try {
    await assert.doesNotReject(
      verifyNpmProvenance('@practicalworks/crm', '0.12.0'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
