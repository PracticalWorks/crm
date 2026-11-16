import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNpmProvenance } from './verify-npm-provenance.mjs';

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

const provenanceStatement = (predicateType = 'https://slsa.dev/provenance/v1') => Buffer.from(JSON.stringify({
  _type: 'https://in-toto.io/Statement/v0.1',
  predicateType,
  predicate: {},
})).toString('base64');

const npmAttestationsResponse = (predicateType = 'https://slsa.dev/provenance/v1') => JSON.stringify({
  attestations: [{
    predicateType,
    bundle: {
      dsseEnvelope: {
        payload: provenanceStatement(predicateType),
      },
    },
  }],
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

test('accepts npm’s nested DSSE provenance attestation shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(200, npmAttestationsResponse());
  try {
    await assert.doesNotReject(
      verifyNpmProvenance('@practicalworks/crm', '0.12.0'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects an attestation whose DSSE payload is not SLSA provenance', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(200, npmAttestationsResponse('https://example.com/other'));
  try {
    await assert.rejects(
      verifyNpmProvenance('@practicalworks/crm', '0.12.0'),
      /no provenance attestation/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
