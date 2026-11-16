import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNpmProvenance, waitForNpmProvenance } from './verify-npm-provenance.mjs';

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

const withFetch = async (responses, run) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => responses[Math.min(calls++, responses.length - 1)];
  try {
    return await run(() => calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
};
const noSleep = { delayMs: 1, sleep: async () => {} };

test('waits through the 404s npm serves right after a publish, then verifies', async () => {
  await withFetch([response(404, '{}'), response(404, '{}'), response(200, npmAttestationsResponse())], async (calls) => {
    assert.equal(await waitForNpmProvenance('@practicalworks/crm', '0.13.0', { ...noSleep, attempts: 5 }), 'https://slsa.dev/provenance/v1');
    assert.equal(calls(), 3);
  });
});

test('gives up after its attempts when the attestation never appears', async () => {
  await withFetch([response(404, '{}')], async (calls) => {
    await assert.rejects(waitForNpmProvenance('@practicalworks/crm', '0.9.0', { ...noSleep, attempts: 3 }), /HTTP 404/);
    assert.equal(calls(), 3);
  });
});

test('does not wait on an answer that is not a delay: no provenance fails at once', async () => {
  await withFetch([response(200, '{}')], async (calls) => {
    await assert.rejects(waitForNpmProvenance('@practicalworks/crm', '0.13.0', { ...noSleep, attempts: 5 }), /no provenance attestation/);
    assert.equal(calls(), 1);
  });
});
