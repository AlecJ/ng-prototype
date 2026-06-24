import { describe, expect, it } from "vitest";
import { selectVisibleChunks } from "./chunkSelection";
import type { PrecomputedScaleMetadata, ViewportState } from "../client/viewerTypes";

const scale: PrecomputedScaleMetadata = {
  key: "0",
  encoding: "raw",
  resolution: [1, 1, 1],
  voxelOffset: [0, 0, 0],
  size: [256, 256, 64],
  chunkSize: [64, 64, 16],
};

describe("selectVisibleChunks", () => {
  it("selects chunks intersecting the xy viewport and current z", () => {
    const viewport: ViewportState = {
      center: [96, 96, 17],
      zoom: 1,
      canvasCssSize: { width: 80, height: 80 },
      devicePixelRatio: 1,
    };
    const result = selectVisibleChunks([scale], viewport);
    expect(result.chunks.map((chunk) => chunk.gridPosition)).toContainEqual([0, 0, 1]);
    expect(result.chunks.map((chunk) => chunk.gridPosition)).toContainEqual([2, 2, 1]);
  });
});