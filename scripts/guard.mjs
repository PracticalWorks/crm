#!/usr/bin/env node
// Keeps this public repo free of what must stay private: credentials, internal
// ticket references, the hostnames of the instances it runs against, and brand
// data. Brands, boards and hosts are injected at run time by whoever uses the
// package, never written here. Scans every tracked file; exits 1 with each hit named.
//
// Brand data is checked against scripts/brand-hashes.json: sha256 hashes of the
// brands' names, slugs, domains and phones, generated from the private brand
// roster. Only hashes are committed, so the list itself names no brand. A line is
// split into lowercase alphanumeric words; every run of one to four words, and the
// same run written without spaces, is hashed and looked up. Phone-like digit runs
// are hashed by their last ten digits.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SELF = "scripts/guard.mjs";
const HASHES = "scripts/brand-hashes.json";

/** Ticket-shaped refs (ABC-123). Standards that look the same are allowed. */
const TICKET = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g;
const NOT_TICKETS = new Set(["UTF", "ISO", "RFC", "SHA", "AES", "ES", "TLS", "HTTP", "CVE", "GHSA", "WCAG", "IEEE", "X"]);

/** Credential shapes. A real value never belongs in this repo. */
const SECRETS = [
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "GitHub token", re: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/ },
  { name: "npm token", re: /\bnpm_[A-Za-z0-9]{30,}/ },
  { name: "AWS key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "API key assignment", re: /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/i },
];

/** Instances this code runs against are configuration, not source. */
const PRIVATE_HOSTS = /\b[a-z0-9-]+\.(practical\.works|breezykeys\.com)\b/i;

const MAX_WORDS = 4;
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Every hashed candidate a line offers for the brand lookup. */
export function brandCandidates(line) {
  const words = line.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= MAX_WORDS && i + n <= words.length; n++) {
      const run = words.slice(i, i + n);
      out.add(run.join(" "));
      out.add(run.join(""));
    }
  }
  for (const m of line.matchAll(PHONE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10) out.add(`phone:${digits.slice(-10)}`);
  }
  return out;
}

/** The findings for one file's text. `brandHashes` is a Set of sha256 hex strings. */
export function scanText(file, text, brandHashes) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    for (const m of line.matchAll(TICKET)) {
      if (!NOT_TICKETS.has(m[1])) hits.push(`${at}: ticket reference ${m[0]}`);
    }
    for (const s of SECRETS) if (s.re.test(line)) hits.push(`${at}: ${s.name}`);
    if (PRIVATE_HOSTS.test(line)) hits.push(`${at}: private host ${line.match(PRIVATE_HOSTS)[0]}`);
    for (const c of brandCandidates(line)) {
      // Name the hash prefix, not the text: the finding itself is printed in public CI logs.
      const h = sha256(c);
      if (brandHashes.has(h)) hits.push(`${at}: brand data (hash ${h.slice(0, 12)})`);
    }
  });
  return hits;
}

export function loadBrandHashes(path = HASHES) {
  const { hashes } = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(hashes) || hashes.length === 0 || !hashes.every((h) => /^[0-9a-f]{64}$/.test(h))) {
    throw new Error(`${path} must hold a non-empty list of sha256 hex hashes`);
  }
  return new Set(hashes);
}

function main() {
  const brandHashes = loadBrandHashes();
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && f !== SELF && f !== HASHES && !f.endsWith("pnpm-lock.yaml"));

  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    hits.push(...scanText(file, text, brandHashes));
  }

  if (hits.length) {
    console.error(`guard: ${hits.length} finding(s) that must not be in a public repo:\n  ${hits.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`guard: ${files.length} files clean`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
