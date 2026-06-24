import type {
  RenderStats,
  ResourceLimits,
  ResourceStats,
  ValidatedSource,
  ViewportState,
} from "../client/viewerTypes";

export type WorkerRequest =
  | { type: "initCanvas"; canvas: OffscreenCanvas }
  | { type: "setSource"; source: ValidatedSource }
  | { type: "setViewport"; viewport: ViewportState }
  | { type: "setResourceLimits"; limits: ResourceLimits }
  | { type: "resize"; width: number; height: number; devicePixelRatio: number }
  | { type: "dispose" };

export type WorkerResponse =
  | { type: "sourceLoaded"; source: ValidatedSource }
  | { type: "renderStats"; stats: RenderStats }
  | { type: "resourceStats"; stats: ResourceStats }
  | { type: "error"; message: string };