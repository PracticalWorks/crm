#!/usr/bin/env node

const provenancePredicateType = 'https://slsa.dev/provenance/v1';

function decodeDssePayload(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** The purl npm writes as an attestation's subject: `pkg:npm/%40scope/name@1.2.3`. */
const npmPurl = (packageName, version) => `pkg:npm/${packageName.replace(/^@/, '%40')}@${version}`;

/**
 * Verifies that `packageName@version` on npm carries SLSA provenance built by
 * `repository`'s `workflowPath` on `ref`. Only an attestation from that source
 * counts: any other repo, workflow or branch can mint a valid-looking SLSA
 * statement, so the predicate type alone proves nothing about this release.
 */
export async function verifyNpmProvenance(packageName, version, {
  repository,
  workflowPath = '.github/workflows/publish.yml',
  ref = 'refs/heads/main',
  registry = 'https://registry.npmjs.org',
} = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) {
    throw new Error('expected source repository (owner/name) is required');
  }
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

  const subject = npmPurl(packageName, version);
  if (!statement.subject?.some((entry) => entry?.name === subject)) {
    throw new Error(`provenance is not for ${subject}`);
  }

  const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow ?? {};
  const want = { repository: `https://github.com/${repository}`, path: workflowPath, ref };
  const got = { repository: workflow.repository, path: workflow.path, ref: workflow.ref };
  const sameRepo = String(got.repository ?? '').toLowerCase() === want.repository.toLowerCase();
  if (!sameRepo || got.path !== want.path || got.ref !== want.ref) {
    throw new Error(
      `provenance was built by ${got.repository ?? '?'} ${got.path ?? '?'} on ${got.ref ?? '?'}, ` +
      `expected ${want.repository} ${want.path} on ${want.ref}`,
    );
  }

  return statement.predicateType;
}

/**
 * npm takes a while to serve a version it just accepted: on 2026-11-16 0.13.0 read
 * 404 for ~20s and its attestation for ~70s after `npm publish` printed success,
 * and on 2026-11-17 another package's attestation took over 5 minutes. So a
 * release check waits up to 15 minutes through 404s (and 5xx) before it calls a
 * release unattested. Any other failure is final at once.
 */
export async function waitForNpmProvenance(packageName, version, {
  attempts = 60,
  delayMs = 15_000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
  ...expected
} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await verifyNpmProvenance(packageName, version, expected);
    } catch (error) {
      const transient = /HTTP (404|5\d\d)\b/.test(error.message);
      if (!transient || attempt >= attempts) throw error;
      log(`attempt ${attempt}/${attempts}: ${error.message}; waiting ${delayMs / 1000}s for the registry`);
      await sleep(delayMs);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [packageName, version, repository] = process.argv.slice(2);

  if (!packageName || !version || !repository) {
    console.error('Usage: node scripts/verify-npm-provenance.mjs <package> <version> <owner/repo>');
    process.exit(2);
  }

  try {
    const predicateType = await waitForNpmProvenance(packageName, version, { repository, log: (line) => console.log(line) });
    console.log(`Verified npm provenance for ${packageName}@${version} (${predicateType}) from ${repository} .github/workflows/publish.yml on refs/heads/main`);
  } catch (error) {
    console.error(`Provenance verification failed for ${packageName}@${version}: ${error.message}`);
    process.exit(1);
  }
}
