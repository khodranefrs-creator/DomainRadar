// Public surface of the RDAP adapter layer.
export {
  loadBootstrap,
  clearBootstrapCache,
  getBootstrapCacheInfo,
  bootstrapBasesFor,
  parseBootstrapServices,
  normalizeBaseUrl,
  BootstrapError,
  IANA_BOOTSTRAP_URL,
} from "./bootstrap";
export {
  rdapLookupDomain,
  buildRdapDomainUrl,
  computeBackoffMs,
  parseRetryAfter,
} from "./client";
export {
  mapHttpResponse,
  isRetriableStatus,
  classifyTransportError,
} from "./mapping";
export { RateLimiter, defaultDelay } from "./rate-limiter";
export {
  runSearch,
  createDefaultSearchDeps,
} from "./service";
export type {
  SearchDeps,
  SearchRequest,
  SearchSummary,
  VariantResult,
  VariantCheckRecord,
  SessionCounts,
  TldInfo,
  SourceInfo,
} from "./service";
export { sourceKeyForHost, knownSourceKeyForHost, KNOWN_RDAP_HOSTS } from "./providers";
export type { BootstrapMap, RdapOutcome, RdapLookupOptions } from "./types";
