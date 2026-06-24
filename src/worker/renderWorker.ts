import type { ResourceLimits, ValidatedSource, ViewportState } from "../client/viewerTypes";
import { selectVisibleChunks } from "../precomputed/chunkSelection";
import { buildUnshardedChunkUrl } from "../precomputed/chunkFetch";
import { decodeChunk } from "../precomputed/decode";
import { WebGpuRenderer } from "../webgpu/renderer";
import { ChunkCache } from "./chunkCache";
import { ChunkScheduler } from "./chunkScheduler";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const renderer = new WebGpuRenderer();
const cache = new ChunkCache();
let source: ValidatedSource | undefined;
let viewport: ViewportState | undefined;
let limits: ResourceLimits = {
  gpuMemoryLimitBytes: 512 * 1024 * 1024,
  systemMemoryLimitBytes: 512 * 1024 * 1024,
  concurrentChunkRequests: 8,
};
const scheduler = new ChunkScheduler<string>(limits.concurrentChunkRequests);

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handleMessage(event.data);
});

async function handleMessage(message: WorkerRequest): Promise<void> {
  try {
    switch (message.type) {
      case "initCanvas":
        await renderer.initialize(message.canvas);
        renderer.render();
        break;
      case "setSource":
        source = message.source;
        scheduler.clear();
        post({ type: "sourceLoaded", source: message.source });
        await updateVisibleChunks();
        break;
      case "setViewport":
        viewport = message.viewport;
        await updateVisibleChunks();
        break;
      case "setResourceLimits":
        limits = message.limits;
        scheduler.setLimit(limits.concurrentChunkRequests);
        enforceAndReport(new Set());
        await updateVisibleChunks();
        break;
      case "resize":
        renderer.render();
        break;
      case "dispose":
        close();
        break;
    }
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

async function updateVisibleChunks(): Promise<void> {
  if (!source || !viewport) return;
  const selection = selectVisibleChunks(source.metadata.scales, viewport);
  const protectedKeys = new Set(selection.chunks.map((chunk) => chunk.key));
  scheduler.enqueue(selection.chunks.map((chunk, index) => ({ key: chunk.key, priority: index, value: chunk.key })));
  const chunksByKey = new Map(selection.chunks.map((chunk) => [chunk.key, chunk]));
  await scheduler.drain(async (key) => {
    const chunk = chunksByKey.get(key);
    if (!chunk || !source) return;
    if (chunk.scale.sharding) {
      post({ type: "error", message: "Sharded precomputed chunks are not implemented in this first milestone." });
      return;
    }
    const url = buildUnshardedChunkUrl(source.source.baseUrl, chunk);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Chunk fetch failed: ${response.status} ${response.statusText}`);
    const decoded = await decodeChunk(chunk.scale.encoding, await response.arrayBuffer(), chunk.scale.chunkSize);
    const bytes = decoded.bytes;
    cache.set({ key, cpuBytes: bytes, gpuBytes: bytes, lastUsed: performance.now() });
    enforceAndReport(protectedKeys);
  });
  renderer.render({ r: 0.04, g: 0.08, b: 0.1, a: 1 });
  post({
    type: "renderStats",
    stats: {
      selectedScaleKey: selection.scale.key,
      visibleChunkCount: selection.chunks.length,
      renderedChunkCount: 0,
    },
  });
  enforceAndReport(protectedKeys);
}

function enforceAndReport(protectedKeys: Set<string>): void {
  cache.enforceLimits(limits.systemMemoryLimitBytes, limits.gpuMemoryLimitBytes, protectedKeys);
  post({ type: "resourceStats", stats: cache.stats(scheduler.pendingCount, scheduler.activeCount) });
}

function post(message: WorkerResponse): void {
  self.postMessage(message);
}