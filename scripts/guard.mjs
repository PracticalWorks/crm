#!/usr/bin/env node
// Keeps this public repo free of what must stay private: credentials, internal
// ticket references, and the hostnames of the instances it runs against. Brands,
// boards and hosts are injected at run time by whoever uses the package, never
// written here. Scans every tracked file; exits 1 with each hit named.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SELF = "scripts/guard.mjs";

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

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && f !== SELF && !f.endsWith("pnpm-lock.yaml"));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    for (const m of line.matchAll(TICKET)) {
      if (!NOT_TICKETS.has(m[1])) hits.push(`${at}: ticket reference ${m[0]}`);
    }
    for (const s of SECRETS) if (s.re.test(line)) hits.push(`${at}: ${s.name}`);
    if (PRIVATE_HOSTS.test(line)) hits.push(`${at}: private host ${line.match(PRIVATE_HOSTS)[0]}`);
  });
}

if (hits.length) {
  console.error(`guard: ${hits.length} finding(s) that must not be in a public repo:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log(`guard: ${files.length} files clean`);
