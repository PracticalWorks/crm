#!/usr/bin/env node

const provenancePredicateType = 'https://slsa.dev/provenance/v1';

function decodeDssePayload(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function verifyNpmProvenance(packageName, version, registry = 'https://registry.npmjs.org') {
  const encodedPackage = encodeURIComponent(packageName);
  const url = `${registry.replace(/\/$/, '')}/-/npm/v1/attestations/${encodedPackage}@${encodeURIComponent(version)}`;
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`registry returned HTTP ${response.status}`);
  }

  let attestations;
  try {
    attestations = JSON.parse(body);
  } catch {
    throw new Error('registry returned invalid JSON');
  }

  const provenance = attestations.attestations?.find(
    (attestation) => attestation.predicateType === provenancePredicateType,
  );
  const payload = provenance?.bundle?.dsseEnvelope?.payload;
  const statement = typeof payload === 'string' ? decodeDssePayload(payload) : null;

  if (statement?.predicateType !== provenancePredicateType) {
    throw new Error('registry returned no provenance attestation');
  }

  return statement.predicateType;
}

/**
 * npm takes a while to serve a version it just accepted: on 2026-11-16 0.13.0 read
 * 404 for ~20s and its attestation for ~70s after `npm publish` printed success.
 * So a release check waits through 404s (and 5xx) before it calls a release
 * unattested. Any other failure is final at once.
 */
export async function waitForNpmProvenance(packageName, version, {
  attempts = 20,
  delayMs = 15_000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await verifyNpmProvenance(packageName, version);
    } catch (error) {
      const transient = /HTTP (404|5\d\d)\b/.test(error.message);
      if (!transient || attempt >= attempts) throw error;
      log(`attempt ${attempt}/${attempts}: ${error.message}; waiting ${delayMs / 1000}s for the registry`);
      await sleep(delayMs);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [packageName, version] = process.argv.slice(2);

  if (!packageName || !version) {
    console.error('Usage: node scripts/verify-npm-provenance.mjs <package> <version>');
    process.exit(2);
  }

  try {
    const predicateType = await waitForNpmProvenance(packageName, version, { log: (line) => console.log(line) });
    console.log(`Verified npm provenance for ${packageName}@${version} (${predicateType})`);
  } catch (error) {
    console.error(`Provenance verification failed for ${packageName}@${version}: ${error.message}`);
    process.exit(1);
  }
}
