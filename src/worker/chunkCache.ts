import type { ResourceStats } from "../client/viewerTypes";

export interface CacheEntry {
	key: string;
	cpuBytes: number;
	gpuBytes: number;
	lastUsed: number;
	/** Uploaded GPU texture. Present after upload, absent for CPU-only entries. */
	texture?: GPUTexture;
	/**
	 * For JPEG/PNG, the full JPEG image height = chunkH * chunkD so UV math can
	 * select the correct Z slice.  For RAW we stack Z slices the same way.
	 * Equals chunkSize[2] so the renderer can compute iz / textureDepth.
	 */
	textureDepth?: number;
	destroyGpu?: () => void;
}

export class ChunkCache {
	private readonly entries = new Map<string, CacheEntry>();
	private evictedCpuCount = 0;
	private evictedGpuCount = 0;

	set(entry: CacheEntry): void {
		this.entries.set(entry.key, { ...entry, lastUsed: performance.now() });
	}

	get(key: string): CacheEntry | undefined {
		return this.entries.get(key);
	}

	touch(key: string): void {
		const entry = this.entries.get(key);
		if (entry) entry.lastUsed = performance.now();
	}

	enforceLimits(
		systemMemoryLimitBytes: number,
		gpuMemoryLimitBytes: number,
		protectedKeys = new Set<string>(),
	): void {
		this.evictCpu(systemMemoryLimitBytes, protectedKeys);
		this.evictGpu(gpuMemoryLimitBytes, protectedKeys);
	}

	stats(
		pendingRequestCount: number,
		activeRequestCount: number,
	): ResourceStats {
		let residentCpuChunkCount = 0;
		let residentCpuBytes = 0;
		let residentGpuChunkCount = 0;
		let residentGpuBytes = 0;
		for (const entry of this.entries.values()) {
			if (entry.cpuBytes > 0) {
				residentCpuChunkCount += 1;
				residentCpuBytes += entry.cpuBytes;
			}
			if (entry.gpuBytes > 0) {
				residentGpuChunkCount += 1;
				residentGpuBytes += entry.gpuBytes;
			}
		}
		return {
			residentGpuChunkCount,
			residentGpuBytes,
			residentCpuChunkCount,
			residentCpuBytes,
			pendingRequestCount,
			activeRequestCount,
			evictedCpuCount: this.evictedCpuCount,
			evictedGpuCount: this.evictedGpuCount,
		};
	}

	private evictCpu(limit: number, protectedKeys: Set<string>): void {
		while (this.totalCpuBytes() > limit) {
			const candidate = this.oldest(
				(entry) => entry.cpuBytes > 0 && !protectedKeys.has(entry.key),
			);
			if (!candidate) break;
			candidate.cpuBytes = 0;
			this.evictedCpuCount += 1;
		}
	}

	private evictGpu(limit: number, protectedKeys: Set<string>): void {
		while (this.totalGpuBytes() > limit) {
			const candidate = this.oldest(
				(entry) => entry.gpuBytes > 0 && !protectedKeys.has(entry.key),
			);
			if (!candidate) break;
			candidate.destroyGpu?.();
			candidate.gpuBytes = 0;
			candidate.destroyGpu = undefined;
			this.evictedGpuCount += 1;
		}
	}

	private oldest(
		predicate: (entry: CacheEntry) => boolean,
	): CacheEntry | undefined {
		return [...this.entries.values()]
			.filter(predicate)
			.sort((a, b) => a.lastUsed - b.lastUsed)[0];
	}

	private totalCpuBytes(): number {
		return [...this.entries.values()].reduce(
			(sum, entry) => sum + entry.cpuBytes,
			0,
		);
	}

	private totalGpuBytes(): number {
		return [...this.entries.values()].reduce(
			(sum, entry) => sum + entry.gpuBytes,
			0,
		);
	}
}
