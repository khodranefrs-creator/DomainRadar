// Maps an RDAP provider hostname to the Source registry key that represents it.
// The source registry (src/lib/source-catalog.ts) is the source of truth for
// permitted use and status; this mapping keeps the audit trail consistent when a
// lookup is persisted as a DomainVariantCheck.

const HOST_SOURCE_KEY: Record<string, string> = {
  "rdap.verisign.com": "rdap_verisign_com",
  "rdap.register.si": "rdap_register_si",
  "rdap.identitydigital.services": "rdap_identity_digital",
  "pubapi.registry.google": "rdap_google_registry",
  "rdap.publicinterestregistry.org": "rdap_pir_org",
  "rdap.radix.host": "rdap_radix",
  "rdap.centralnic.com": "rdap_centralnic_xyz",
  "rdap.registry.cloud": "rdap_registry_cloud",
};

export const KNOWN_RDAP_HOSTS: string[] = Object.keys(HOST_SOURCE_KEY);

/** Deterministic fallback source key for an unknown-but-approved provider host. */
export function sanitizeHostToKey(host: string): string {
  const slug = host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `rdap_${slug}`;
}

export function sourceKeyForHost(host: string): string {
  return HOST_SOURCE_KEY[host.toLowerCase()] ?? sanitizeHostToKey(host);
}

export function knownSourceKeyForHost(host: string): string | null {
  return HOST_SOURCE_KEY[host.toLowerCase()] ?? null;
}
