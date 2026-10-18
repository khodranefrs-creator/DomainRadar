// Live RDAP smoke test. NOT part of the unit suite (tests/live is excluded by
// vitest.config.mts). Run manually on demand:
//
//   npx tsx tests/live/rdap-smoke.ts
//
// It performs a handful of real, low-volume, respectful requests against public
// registry RDAP endpoints to confirm the adapter works end-to-end. It writes
// nothing to the database and rate-limits to ~1 request/second.

import {
  loadBootstrap,
  bootstrapBasesFor,
  clearBootstrapCache,
} from "../../src/lib/rdap/bootstrap";
import { rdapLookupDomain } from "../../src/lib/rdap/client";
import { RateLimiter } from "../../src/lib/rdap/rate-limiter";

const targets: Array<{ fqdn: string; tld: string }> = [
  { fqdn: "google.com", tld: ".com" },
  { fqdn: "google.si", tld: ".si" },
  { fqdn: "openai.ai", tld: ".ai" },
  { fqdn: "zzz-definitely-not-registered-9f3a1.com", tld: ".com" },
];

function pad(value: string, width: number): string {
  return value.length >= width ? value : value.padEnd(width);
}

async function main(): Promise<void> {
  clearBootstrapCache();
  const limiter = new RateLimiter(1000);

  console.log("== IANA RDAP bootstrap ==");
  const started = Date.now();
  const bootstrap = await loadBootstrap({ force: true });
  console.log(
    `fetched in ${Date.now() - started}ms — ${bootstrap.services.size} TLDs`,
  );

  console.log("\n== RDAP domain lookups ==");
  for (const target of targets) {
    const base = bootstrapBasesFor(bootstrap, target.tld)[0];
    if (!base) {
      console.log(`${target.tld}: no bootstrap base — skipping`);
      continue;
    }
    const outcome = await rdapLookupDomain(target.fqdn, base, {
      rateLimiter: limiter,
      timeoutMs: 10_000,
      maxRetries: 1,
    });
    console.log(
      [
        pad(target.fqdn, 14),
        pad(outcome.status, 18),
        `http=${outcome.httpStatus ?? "—"}`,
        `host=${outcome.providerHost ?? "—"}`,
        `attempts=${outcome.attempts}`,
        `${outcome.responseMs ?? "-"}ms`,
      ].join("  "),
    );
  }

  console.log("\n== Unsupported extension (no network call) ==");
  console.log(
    `.co bootstrap bases: ${bootstrapBasesFor(bootstrap, ".co").length} (expected 0)`,
  );
}

main().catch((error: unknown) => {
  console.error("Live smoke test failed:", error);
  process.exitCode = 1;
});
