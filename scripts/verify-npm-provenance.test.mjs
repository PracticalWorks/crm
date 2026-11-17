import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNpmProvenance, waitForNpmProvenance } from './verify-npm-provenance.mjs';

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

const SOURCE = { repository: 'PracticalWorks/example' };
const goodWorkflow = {
  repository: 'https://github.com/PracticalWorks/example',
  path: '.github/workflows/publish.yml',
  ref: 'refs/heads/main',
};

const provenanceStatement = (predicateType = 'https://slsa.dev/provenance/v1', { workflow = goodWorkflow, subject } = {}) => Buffer.from(JSON.stringify({
  _type: 'https://in-toto.io/Statement/v1',
  subject: [{ name: subject ?? '__SUBJECT__' }],
  predicateType,
  predicate: { buildDefinition: { externalParameters: { workflow } } },
})).toString('base64');

const npmAttestationsResponse = (predicateType = 'https://slsa.dev/provenance/v1', options = {}, version = '0.12.0') => JSON.stringify({
  attestations: [{
    predicateType,
    bundle: {
      dsseEnvelope: {
        payload: provenanceStatement(predicateType, { subject: `pkg:npm/%40practicalworks/crm@${version}`, ...options }),
      },
    },
  }],
});

test('rejects a registry 404 instead of treating it as provenance', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(404, '{"error":"Not found"}');
  try {
    await assert.rejects(
      verifyNpmProvenance('@practicalworks/crm', '0.9.0', SOURCE),
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
      verifyNpmProvenance('@practicalworks/crm', '0.9.0', SOURCE),
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
      verifyNpmProvenance('@practicalworks/crm', '0.12.0', SOURCE),
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
      verifyNpmProvenance('@practicalworks/crm', '0.12.0', SOURCE),
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
  await withFetch([response(404, '{}'), response(404, '{}'), response(200, npmAttestationsResponse(undefined, {}, '0.13.0'))], async (calls) => {
    assert.equal(await waitForNpmProvenance('@practicalworks/crm', '0.13.0', { ...SOURCE, ...noSleep, attempts: 5 }), 'https://slsa.dev/provenance/v1');
    assert.equal(calls(), 3);
  });
});

test('gives up after its attempts when the attestation never appears', async () => {
  await withFetch([response(404, '{}')], async (calls) => {
    await assert.rejects(waitForNpmProvenance('@practicalworks/crm', '0.9.0', { ...SOURCE, ...noSleep, attempts: 3 }), /HTTP 404/);
    assert.equal(calls(), 3);
  });
});

test('does not wait on an answer that is not a delay: no provenance fails at once', async () => {
  await withFetch([response(200, '{}')], async (calls) => {
    await assert.rejects(waitForNpmProvenance('@practicalworks/crm', '0.13.0', { ...SOURCE, ...noSleep, attempts: 5 }), /no provenance attestation/);
    assert.equal(calls(), 1);
  });
});

// The source checks. Any repo can mint a valid SLSA statement, so each of these
// must fail even though the predicate type is right.
const rejectsWith = async (body, pattern, expected = SOURCE) => {
  await withFetch([response(200, body)], async () => {
    await assert.rejects(verifyNpmProvenance('@practicalworks/crm', '0.12.0', expected), pattern);
  });
};

test('rejects provenance built by another repository', async () => {
  await rejectsWith(
    npmAttestationsResponse(undefined, { workflow: { ...goodWorkflow, repository: 'https://github.com/evil/not-this-repo' } }),
    /built by https:\/\/github.com\/evil\/not-this-repo .* expected https:\/\/github.com\/PracticalWorks\/example/,
  );
});

test('rejects provenance from another workflow in the right repository', async () => {
  await rejectsWith(
    npmAttestationsResponse(undefined, { workflow: { ...goodWorkflow, path: '.github/workflows/other.yml' } }),
    /other\.yml/,
  );
});

test('rejects provenance built from a branch other than main', async () => {
  await rejectsWith(
    npmAttestationsResponse(undefined, { workflow: { ...goodWorkflow, ref: 'refs/heads/feature' } }),
    /refs\/heads\/feature/,
  );
});

test('rejects provenance whose subject is another package or version', async () => {
  await rejectsWith(
    npmAttestationsResponse(undefined, { subject: 'pkg:npm/%40someone/else@0.12.0' }),
    /provenance is not for pkg:npm\//,
  );
});

test('refuses to verify without an expected source repository', async () => {
  await rejectsWith(npmAttestationsResponse(), /expected source repository/, {});
});

test('a source mismatch is final: it is not retried like a registry delay', async () => {
  const wrong = npmAttestationsResponse(undefined, { workflow: { ...goodWorkflow, repository: 'https://github.com/evil/x' } });
  await withFetch([response(200, wrong)], async (calls) => {
    await assert.rejects(waitForNpmProvenance('@practicalworks/crm', '0.12.0', { ...SOURCE, ...noSleep, attempts: 5 }), /built by/);
    assert.equal(calls(), 1);
  });
});
