import { describe, expect, it } from "vitest";
import { applyWheelInteraction } from "./interactions";
import type { ViewportState } from "./viewerTypes";

const viewport: ViewportState = {
  center: [100, 200, 10],
  zoom: 2,
  canvasCssSize: { width: 100, height: 100 },
  devicePixelRatio: 1,
};

describe("applyWheelInteraction", () => {
  it("changes z on default wheel", () => {
    const next = applyWheelInteraction(
      viewport,
      { deltaY: 120, deltaMode: 0, ctrlKey: false, clientX: 50, clientY: 50 },
      { left: 0, top: 0, width: 100, height: 100 },
    );
    expect(next.center[2]).toBe(11);
    expect(next.zoom).toBe(2);
  });

  it("keeps cursor voxel stable during ctrl wheel zoom", () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    const event = { deltaY: 120, deltaMode: 0, ctrlKey: true, clientX: 75, clientY: 40 };
    const beforeVoxelX = viewport.center[0] + (event.clientX - rect.width / 2) * viewport.zoom;
    const beforeVoxelY = viewport.center[1] + (event.clientY - rect.height / 2) * viewport.zoom;
    const next = applyWheelInteraction(viewport, event, rect);
    const afterVoxelX = next.center[0] + (event.clientX - rect.width / 2) * next.zoom;
    const afterVoxelY = next.center[1] + (event.clientY - rect.height / 2) * next.zoom;
    expect(afterVoxelX).toBeCloseTo(beforeVoxelX);
    expect(afterVoxelY).toBeCloseTo(beforeVoxelY);
  });
});