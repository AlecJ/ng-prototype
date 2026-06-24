import { describe, expect, it } from "vitest";
import { ChunkScheduler } from "./chunkScheduler";

describe("ChunkScheduler", () => {
  it("does not exceed the concurrency limit", async () => {
    const scheduler = new ChunkScheduler<number>(2);
    let active = 0;
    let maxActive = 0;
    scheduler.enqueue([1, 2, 3, 4].map((value) => ({ key: String(value), priority: value, value })));
    await scheduler.drain(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});