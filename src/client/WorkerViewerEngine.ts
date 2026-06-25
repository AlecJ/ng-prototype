import type { ViewerEngine } from "./ViewerEngine";
import { validatePrecomputedMetadata } from "./precomputed/metadata";
import { normalizePrecomputedSource } from "./precomputed/sourceUrl";
import type {
  ResourceLimits,
  ValidatedSource,
  ViewerEvent,
  ViewerEventListener,
  ViewportState,
} from "./viewerTypes";
import type { WorkerRequest, WorkerResponse } from "../worker/protocol";

export class WorkerViewerEngine implements ViewerEngine {
  private readonly listeners = new Set<ViewerEventListener>();
  private readonly worker = new Worker(new URL("../worker/renderWorker.ts", import.meta.url), {
    type: "module",
  });
  private attached = false;
  private disposed = false;

  get isDisposed(): boolean {
    return this.disposed;
  }

  constructor() {
    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      this.emit(workerResponseToViewerEvent(event.data));
    });
    this.worker.addEventListener("error", (event) => {
      this.emit({ type: "error", message: event.message });
    });
  }

  async attachCanvas(canvas: HTMLCanvasElement): Promise<void> {
    if (this.disposed || this.attached) return;
    if (!("gpu" in navigator)) {
      this.emit({ type: "error", message: "WebGPU is not available in this browser." });
      return;
    }
    if (!("transferControlToOffscreen" in canvas)) {
      this.emit({ type: "error", message: "OffscreenCanvas is not available in this browser." });
      return;
    }
    const offscreen = canvas.transferControlToOffscreen();
    this.post({ type: "initCanvas", canvas: offscreen }, [offscreen]);
    this.attached = true;
  }

  async setSource(sourceInput: string): Promise<void> {
    if (this.disposed) {
      this.emit({ type: "error", message: "Viewer engine has been disposed." });
      return;
    }
    try {
      const source = normalizePrecomputedSource(sourceInput);
      const response = await fetch(source.infoUrl);
      if (!response.ok) {
        throw new Error(`Unable to fetch metadata info: ${response.status} ${response.statusText}`);
      }
      const info: unknown = await response.json();
      const result = validatePrecomputedMetadata(info);
      this.emit({ type: "metadataIssues", issues: result.issues });
      if (!result.metadata) {
        const firstError = result.issues.find((issue) => issue.severity === "error");
        this.emit({
          type: "error",
          message: firstError?.message ?? "Metadata validation failed.",
        });
        return;
      }
      const validatedSource: ValidatedSource = { source, metadata: result.metadata };
      this.post({ type: "setSource", source: validatedSource });
      this.emit({ type: "sourceLoaded", source: validatedSource });
    } catch (error) {
      this.emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  setViewport(viewport: ViewportState): void {
    this.post({ type: "setViewport", viewport });
  }

  setResourceLimits(limits: ResourceLimits): void {
    this.post({ type: "setResourceLimits", limits });
  }

  subscribe(listener: ViewerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.post({ type: "dispose" });
    this.worker.terminate();
    this.listeners.clear();
    this.disposed = true;
  }

  private post(message: WorkerRequest, transfers: Transferable[] = []): void {
    if (this.disposed) return;
    this.worker.postMessage(message, transfers);
  }

  private emit(event: ViewerEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function workerResponseToViewerEvent(response: WorkerResponse): ViewerEvent {
  switch (response.type) {
    case "sourceLoaded":
      return { type: "sourceLoaded", source: response.source };
    case "renderStats":
      return { type: "renderStats", stats: response.stats };
    case "resourceStats":
      return { type: "resourceStats", stats: response.stats };
    case "error":
      return { type: "error", message: response.message };
  }
}