import { describe, expect, it } from "vitest";
import { buildUnshardedChunkUrl, encodeZIndexCompressed3d } from "./chunkFetch";
import type { VisibleChunk } from "./chunkSelection";

const chunk: VisibleChunk = {
  key: "0:1:2:3",
  gridPosition: [1, 2, 3],
  voxelStart: [64, 128, 48],
  voxelEnd: [128, 192, 64],
  scale: {
    key: "0",
    encoding: "raw",
    resolution: [1, 1, 1],
    voxelOffset: [0, 0, 0],
    size: [256, 256, 64],
    chunkSize: [64, 64, 16],
  },
};

describe("chunkFetch", () => {
  it("builds unsharded precomputed chunk urls", () => {
    expect(buildUnshardedChunkUrl("https://example.test/data", chunk)).toBe(
      "https://example.test/data/0/64-128_128-192_48-64",
    );
  });

  it("encodes compressed morton order", () => {
    expect(encodeZIndexCompressed3d(2, 2, 2, [1, 2, 3])).toBe(53n);
  });
});