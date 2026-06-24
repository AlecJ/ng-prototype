import { describe, expect, it } from "vitest";
import { normalizePrecomputedSource } from "./sourceUrl";

describe("normalizePrecomputedSource", () => {
  it("converts public GCS sources and strips neuroglancer suffix", () => {
    const source = normalizePrecomputedSource(
      "gs://bucket/path/to/data/|neuroglancer-precomputed:",
    );
    expect(source.baseUrl).toBe("https://storage.googleapis.com/bucket/path/to/data");
    expect(source.infoUrl).toBe("https://storage.googleapis.com/bucket/path/to/data/info");
  });

  it("accepts https roots", () => {
    expect(normalizePrecomputedSource("https://example.test/data/").baseUrl).toBe(
      "https://example.test/data",
    );
  });
});