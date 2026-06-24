import type { NormalizedPrecomputedSource } from "../viewerTypes";

const precomputedSuffix = "|neuroglancer-precomputed:";

export function normalizePrecomputedSource(input: string): NormalizedPrecomputedSource {
  const trimmed = input.trim();
  const withoutSuffix = trimmed.endsWith(precomputedSuffix)
    ? trimmed.slice(0, -precomputedSuffix.length)
    : trimmed;
  const baseUrl = normalizeBaseUrl(withoutSuffix);
  return {
    input: trimmed,
    baseUrl,
    infoUrl: `${baseUrl}/info`,
  };
}

function normalizeBaseUrl(value: string): string {
  if (value.startsWith("gs://")) {
    const rest = value.slice("gs://".length).replace(/^\/+/, "");
    if (rest.length === 0) throw new Error("GCS source is missing a bucket name.");
    return stripTrailingSlash(`https://storage.googleapis.com/${rest}`);
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return stripTrailingSlash(value);
  }
  throw new Error("Source must be a public gs://, http://, or https:// precomputed root.");
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}