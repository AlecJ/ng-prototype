export type Vec3 = [number, number, number];

export type MetadataIssueSeverity = "warning" | "error";

export interface MetadataIssue {
  severity: MetadataIssueSeverity;
  message: string;
  path?: string;
}

export type VolumeDataType =
  | "uint8"
  | "uint16"
  | "uint32"
  | "uint64"
  | "float32";

export type ChunkEncoding = "raw" | "jpeg" | "png" | "jxl" | "compresso";

export interface ShardingParameters {
  hash: string;
  preshiftBits: number;
  minishardBits: number;
  shardBits: number;
  minishardIndexEncoding: string;
  dataEncoding: string;
}

export interface PrecomputedScaleMetadata {
  key: string;
  encoding: ChunkEncoding;
  resolution: Vec3;
  voxelOffset: Vec3;
  size: Vec3;
  chunkSize: Vec3;
  sharding?: ShardingParameters;
}

export interface PrecomputedMetadata {
  dataType: VolumeDataType;
  numChannels: number;
  scales: PrecomputedScaleMetadata[];
}

export interface NormalizedPrecomputedSource {
  input: string;
  baseUrl: string;
  infoUrl: string;
}

export interface ValidatedSource {
  source: NormalizedPrecomputedSource;
  metadata: PrecomputedMetadata;
}

export interface ViewportState {
  center: Vec3;
  zoom: number;
  canvasCssSize: { width: number; height: number };
  devicePixelRatio: number;
}

export interface ResourceLimits {
  gpuMemoryLimitBytes: number;
  systemMemoryLimitBytes: number;
  concurrentChunkRequests: number;
}

export interface RenderStats {
  selectedScaleKey?: string;
  visibleChunkCount: number;
  renderedChunkCount: number;
}

export interface ResourceStats {
  residentGpuChunkCount: number;
  residentGpuBytes: number;
  residentCpuChunkCount: number;
  residentCpuBytes: number;
  pendingRequestCount: number;
  activeRequestCount: number;
  evictedCpuCount: number;
  evictedGpuCount: number;
}

export type ViewerEvent =
  | { type: "metadataIssues"; issues: MetadataIssue[] }
  | { type: "sourceLoaded"; source: ValidatedSource }
  | { type: "renderStats"; stats: RenderStats }
  | { type: "resourceStats"; stats: ResourceStats }
  | { type: "error"; message: string };

export type ViewerEventListener = (event: ViewerEvent) => void;