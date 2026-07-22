import type {
	ResourceLimits,
	ValidatedSource,
	ViewportState,
} from "../client/viewerTypes";
import { selectVisibleChunks } from "../precomputed/chunkSelection";
import type { VisibleChunk } from "../precomputed/chunkSelection";
import { buildUnshardedChunkUrl } from "../precomputed/chunkFetch";
import { decodeChunk } from "../precomputed/decode";
import { WebGpuRenderer } from "../webgpu/renderer";
import type { ChunkRenderData } from "../webgpu/renderer";
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
				renderVisible();
				await updateVisibleChunks();
				break;
			case "setResourceLimits":
				limits = message.limits;
				scheduler.setLimit(limits.concurrentChunkRequests);
				enforceAndReport(new Set());
				await updateVisibleChunks();
				break;
			case "resize":
				renderVisible();
				break;
			case "dispose":
				close();
				break;
		}
	} catch (error) {
		post({
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
	}
}

async function updateVisibleChunks(): Promise<void> {
	if (!source || !viewport) return;
	const selection = selectVisibleChunks(source.metadata.scales, viewport);
	const protectedKeys = new Set(selection.chunks.map((chunk) => chunk.key));
	scheduler.enqueue(
		selection.chunks.map((chunk, index) => ({
			key: chunk.key,
			priority: index,
			value: chunk.key,
		})),
	);
	const chunksByKey = new Map(
		selection.chunks.map((chunk) => [chunk.key, chunk]),
	);
	scheduler.drain(async (key) => {
		const chunk = chunksByKey.get(key);
		if (!chunk || !source) return;
		if (chunk.scale.sharding) {
			post({
				type: "error",
				message:
					"Sharded precomputed chunks are not implemented in this first milestone.",
			});
			return;
		}
		const url = buildUnshardedChunkUrl(source.source.baseUrl, chunk);
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(
				`Chunk fetch failed: ${response.status} ${response.statusText}`,
			);
		const decoded = await decodeChunk(
			chunk.scale.encoding,
			await response.arrayBuffer(),
			chunk.scale.chunkSize,
		);

		const uploaded = await renderer.uploadChunk(
			decoded,
			chunk.scale.chunkSize[2],
			source.metadata.dataType,
			source.metadata.numChannels,
		);

		if (uploaded) {
			cache.set({
				key,
				cpuBytes: decoded.bytes,
				gpuBytes: uploaded.gpuBytes,
				lastUsed: performance.now(),
				texture: uploaded.texture,
				textureDepth: uploaded.textureDepth,
				destroyGpu: () => uploaded.texture.destroy(),
			});
		} else {
			// Renderer not yet ready – store CPU-only entry; will render on next viewport update.
			cache.set({
				key,
				cpuBytes: decoded.bytes,
				gpuBytes: 0,
				lastUsed: performance.now(),
			});
		}

		enforceAndReport(protectedKeys);
		// Re-render after each chunk arrives so the user sees progressive loading.
		renderVisible();
	});

	// Final render after all queued chunks finish.
	renderVisible();
	enforceAndReport(protectedKeys);
}

/** Render the current set of visible chunks from the cache. */
function renderVisible(): void {
	if (!viewport || !source) {
		renderer.render();
		return;
	}

	const selection = selectVisibleChunks(source.metadata.scales, viewport);
	const chunkData: ChunkRenderData[] = [];
	let renderedCount = 0;

	for (const chunk of selection.chunks) {
		const entry = cache.get(chunk.key);
		if (!entry?.texture || !entry.textureDepth) continue;
		chunkData.push(
			buildChunkRenderData(
				chunk,
				viewport,
				entry.texture,
				entry.textureDepth,
			),
		);
		renderedCount++;
	}

	renderer.render(chunkData, { r: 0.04, g: 0.08, b: 0.1, a: 1 });

	post({
		type: "renderStats",
		stats: {
			selectedScaleKey: selection.scale.key,
			visibleChunkCount: selection.chunks.length,
			renderedChunkCount: renderedCount,
		},
	});
}

/**
 * Compute NDC quad corners and UV range for a single chunk given the current viewport.
 *
 * Coordinate conventions:
 *   - zoom = voxels per CSS pixel
 *   - canvasCssSize is in CSS pixels; NDC always covers [-1, 1] regardless of devicePixelRatio
 *   - Voxel Y increases downward (image convention), WebGPU NDC Y increases upward
 *   - JPEG/PNG texture height = chunkSize[1] * chunkSize[2]; Z slices are stacked vertically
 */
function buildChunkRenderData(
	chunk: VisibleChunk,
	vp: ViewportState,
	texture: GPUTexture,
	textureDepth: number,
): ChunkRenderData {
	const { center, zoom, canvasCssSize } = vp;
	const W = canvasCssSize.width;
	const H = canvasCssSize.height;

	// Voxel → NDC helpers.
	// toNdcX: voxels right of center → positive NDC X
	// toNdcY: voxels above center (smaller voxel Y) → positive NDC Y
	const toNdcX = (vx: number) => ((vx - center[0]) / zoom) * (2 / W);
	const toNdcY = (vy: number) => ((center[1] - vy) / zoom) * (2 / H);

	const ndcLeft = toNdcX(chunk.voxelStart[0]);
	const ndcRight = toNdcX(chunk.voxelEnd[0]);
	const ndcTop = toNdcY(chunk.voxelStart[1]); // smaller voxel Y → top of screen
	const ndcBottom = toNdcY(chunk.voxelEnd[1]); // larger voxel Y → bottom of screen

	// UV range for the Z slice within the stacked texture.
	const D = textureDepth;
	const localZ = Math.floor(center[2]) - chunk.voxelStart[2];
	const iz = Math.max(0, Math.min(D - 1, localZ));

	return {
		texture,
		ndcLeft,
		ndcRight,
		ndcTop,
		ndcBottom,
		uvMinX: 0,
		uvMaxX: 1,
		uvMinY: iz / D,
		uvMaxY: (iz + 1) / D,
	};
}

function enforceAndReport(protectedKeys: Set<string>): void {
	cache.enforceLimits(
		limits.systemMemoryLimitBytes,
		limits.gpuMemoryLimitBytes,
		protectedKeys,
	);
	post({
		type: "resourceStats",
		stats: cache.stats(scheduler.pendingCount, scheduler.activeCount),
	});
}

function post(message: WorkerResponse): void {
	self.postMessage(message);
}
