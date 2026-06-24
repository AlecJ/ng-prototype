import { describe, expect, it } from "vitest";
import { validatePrecomputedMetadata } from "./metadata";

const validInfo = {
  type: "image",
  data_type: "uint8",
  num_channels: 1,
  scales: [
    {
      key: "0",
      encoding: "jpeg",
      resolution: [4, 4, 40],
      voxel_offset: [0, 0, 0],
      size: [1024, 1024, 128],
      chunk_sizes: [[64, 64, 16]],
    },
  ],
};

describe("validatePrecomputedMetadata", () => {
  it("accepts valid image metadata", () => {
    const result = validatePrecomputedMetadata(validInfo);
    expect(result.metadata?.scales[0].chunkSize).toEqual([64, 64, 16]);
    expect(result.issues).toEqual([]);
  });

  it("rejects segmentation metadata", () => {
    const result = validatePrecomputedMetadata({ ...validInfo, type: "segmentation" });
    expect(result.metadata).toBeUndefined();
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});