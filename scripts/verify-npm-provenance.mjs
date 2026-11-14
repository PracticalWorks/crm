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

if (import.meta.url === `file://${process.argv[1]}`) {
  const [packageName, version] = process.argv.slice(2);

  if (!packageName || !version) {
    console.error('Usage: node scripts/verify-npm-provenance.mjs <package> <version>');
    process.exit(2);
  }

  try {
    const predicateType = await verifyNpmProvenance(packageName, version);
    console.log(`Verified npm provenance for ${packageName}@${version} (${predicateType})`);
  } catch (error) {
    console.error(`Provenance verification failed for ${packageName}@${version}: ${error.message}`);
    process.exit(1);
  }
}
