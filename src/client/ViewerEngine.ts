import type {
  ResourceLimits,
  ViewerEventListener,
  ViewportState,
} from "./viewerTypes";

export interface ViewerEngine {
  attachCanvas(canvas: HTMLCanvasElement): Promise<void>;
  setSource(sourceInput: string): Promise<void>;
  setViewport(viewport: ViewportState): void;
  setResourceLimits(limits: ResourceLimits): void;
  subscribe(listener: ViewerEventListener): () => void;
  dispose(): void;
}