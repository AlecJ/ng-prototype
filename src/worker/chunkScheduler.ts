export interface QueueItem<T> {
	key: string;
	priority: number;
	value: T;
}

export class ChunkScheduler<T> {
	private queue: QueueItem<T>[] = [];
	private active = 0;
	private limit: number;
	private worker: ((value: T) => Promise<void>) | undefined;

	constructor(limit: number) {
		this.limit = Math.max(1, Math.floor(limit));
	}

	setLimit(limit: number): void {
		this.limit = Math.max(1, Math.floor(limit));
		this._tick();
	}

	enqueue(items: QueueItem<T>[]): void {
		const existing = new Set(this.queue.map((item) => item.key));
		for (const item of items) {
			if (!existing.has(item.key)) this.queue.push(item);
		}
		this.queue.sort((a, b) => a.priority - b.priority);
	}

	drain(worker: (value: T) => Promise<void>): void {
		this.worker = worker;
		this._tick();
	}

	private _tick(): void {
		if (!this.worker) return;
		while (this.active < this.limit && this.queue.length > 0) {
			const item = this.queue.shift()!;
			this.active += 1;
			void this.worker(item.value).finally(() => {
				this.active -= 1;
				this._tick();
			});
		}
	}

	get pendingCount() {
		return this.queue.length;
	}

	get activeCount() {
		return this.active;
	}

	clear(): void {
		this.queue = [];
	}
}
