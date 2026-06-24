import { describe, expect, it } from "vitest";
import { ChunkCache } from "./chunkCache";

describe("ChunkCache", () => {
  it("evicts cpu and gpu entries to satisfy limits", () => {
    const cache = new ChunkCache();
    let destroyed = 0;
    cache.set({ key: "a", cpuBytes: 10, gpuBytes: 10, lastUsed: 1, destroyGpu: () => { destroyed += 1; } });
    cache.set({ key: "b", cpuBytes: 10, gpuBytes: 10, lastUsed: 2, destroyGpu: () => { destroyed += 1; } });
    cache.enforceLimits(10, 10);
    const stats = cache.stats(0, 0);
    expect(stats.residentCpuBytes).toBe(10);
    expect(stats.residentGpuBytes).toBe(10);
    expect(destroyed).toBe(1);
  });
});