import type {
  ChunkEncoding,
  MetadataIssue,
  PrecomputedMetadata,
  PrecomputedScaleMetadata,
  ShardingParameters,
  Vec3,
  VolumeDataType,
} from "../viewerTypes";

export interface MetadataValidationResult {
  metadata?: PrecomputedMetadata;
  issues: MetadataIssue[];
}

const supportedDataTypes = new Set<VolumeDataType>([
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "float32",
]);

const supportedEncodings = new Set<ChunkEncoding>([
  "raw",
  "jpeg",
  "png",
  "jxl",
  "compresso",
]);

export function validatePrecomputedMetadata(value: unknown): MetadataValidationResult {
  const issues: MetadataIssue[] = [];
  if (!isRecord(value)) {
    return { issues: [{ severity: "error", message: "Metadata info must be an object." }] };
  }

  if (value.type !== "image") {
    issues.push({
      severity: "error",
      message: `Only precomputed image volumes are supported; found ${String(value.type)}.`,
      path: "type",
    });
  }

  const dataType = readEnum(value, "data_type", supportedDataTypes, issues);
  const numChannels = readPositiveInteger(value, "num_channels", issues);
  const scalesValue = value.scales;
  const scales: PrecomputedScaleMetadata[] = [];
  if (!Array.isArray(scalesValue) || scalesValue.length === 0) {
    issues.push({
      severity: "error",
      message: "Metadata must include at least one scale.",
      path: "scales",
    });
  } else {
    scalesValue.forEach((scaleValue, index) => {
      const parsed = parseScale(scaleValue, index, issues);
      if (parsed) scales.push(parsed);
    });
  }

  if (issues.some((issue) => issue.severity === "error")) return { issues };

  return {
    metadata: {
      dataType: dataType!,
      numChannels: numChannels!,
      scales,
    },
    issues,
  };
}

function parseScale(
  value: unknown,
  index: number,
  issues: MetadataIssue[],
): PrecomputedScaleMetadata | undefined {
  const prefix = `scales[${index}]`;
  if (!isRecord(value)) {
    issues.push({ severity: "error", message: "Scale must be an object.", path: prefix });
    return undefined;
  }

  const key = readString(value, "key", issues, prefix);
  const encoding = readEnum(value, "encoding", supportedEncodings, issues, prefix);
  const resolution = readVec3(value, "resolution", issues, prefix, true);
  const voxelOffset = readVec3(value, "voxel_offset", issues, prefix, false) ?? [0, 0, 0];
  const size = readVec3(value, "size", issues, prefix, true);
  const chunkSize = readFirstChunkSize(value, issues, prefix);
  const sharding = parseSharding(value.sharding, `${prefix}.sharding`, issues);

  if (!key || !encoding || !resolution || !size || !chunkSize) return undefined;
  return { key, encoding, resolution, voxelOffset, size, chunkSize, sharding };
}

function readFirstChunkSize(
  value: Record<string, unknown>,
  issues: MetadataIssue[],
  prefix: string,
): Vec3 | undefined {
  const chunkSizes = value.chunk_sizes;
  if (!Array.isArray(chunkSizes) || chunkSizes.length === 0) {
    issues.push({
      severity: "error",
      message: "Scale must include chunk_sizes.",
      path: `${prefix}.chunk_sizes`,
    });
    return undefined;
  }
  if (chunkSizes.length > 1) {
    issues.push({
      severity: "warning",
      message: "Multiple chunk sizes are present; the prototype will use the first size.",
      path: `${prefix}.chunk_sizes`,
    });
  }
  return parseVec3(chunkSizes[0], `${prefix}.chunk_sizes[0]`, issues, true);
}

function parseSharding(
  value: unknown,
  itemPath: string,
  issues: MetadataIssue[],
): ShardingParameters | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    issues.push({ severity: "error", message: "Sharding metadata must be an object.", path: itemPath });
    return undefined;
  }
  const hash = readString(value, "hash", issues, itemPath);
  const preshiftBits = readNonNegativeInteger(value, "preshift_bits", issues, itemPath);
  const minishardBits = readNonNegativeInteger(value, "minishard_bits", issues, itemPath);
  const shardBits = readNonNegativeInteger(value, "shard_bits", issues, itemPath);
  const minishardIndexEncoding = readString(value, "minishard_index_encoding", issues, itemPath);
  const dataEncoding = readString(value, "data_encoding", issues, itemPath);
  if (
    hash === undefined ||
    preshiftBits === undefined ||
    minishardBits === undefined ||
    shardBits === undefined ||
    minishardIndexEncoding === undefined ||
    dataEncoding === undefined
  ) {
    return undefined;
  }
  return { hash, preshiftBits, minishardBits, shardBits, minishardIndexEncoding, dataEncoding };
}

function readString(
  obj: Record<string, unknown>,
  key: string,
  issues: MetadataIssue[],
  prefix = "",
): string | undefined {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    issues.push({
      severity: "error",
      message: `${key} must be a non-empty string.`,
      path: path(prefix, key),
    });
    return undefined;
  }
  return value;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  values: Set<T>,
  issues: MetadataIssue[],
  prefix = "",
): T | undefined {
  const value = obj[key];
  if (typeof value !== "string" || !values.has(value as T)) {
    issues.push({
      severity: "error",
      message: `${key} has unsupported value ${String(value)}.`,
      path: path(prefix, key),
    });
    return undefined;
  }
  return value as T;
}

function readPositiveInteger(
  obj: Record<string, unknown>,
  key: string,
  issues: MetadataIssue[],
  prefix = "",
): number | undefined {
  const value = obj[key];
  if (!Number.isInteger(value) || Number(value) <= 0) {
    issues.push({
      severity: "error",
      message: `${key} must be a positive integer.`,
      path: path(prefix, key),
    });
    return undefined;
  }
  return Number(value);
}

function readNonNegativeInteger(
  obj: Record<string, unknown>,
  key: string,
  issues: MetadataIssue[],
  prefix = "",
): number | undefined {
  const value = obj[key];
  if (!Number.isInteger(value) || Number(value) < 0) {
    issues.push({
      severity: "error",
      message: `${key} must be a non-negative integer.`,
      path: path(prefix, key),
    });
    return undefined;
  }
  return Number(value);
}

function readVec3(
  obj: Record<string, unknown>,
  key: string,
  issues: MetadataIssue[],
  prefix: string,
  positive: boolean,
): Vec3 | undefined {
  const value = obj[key];
  if (value === undefined && key === "voxel_offset") return undefined;
  return parseVec3(value, path(prefix, key), issues, positive);
}

function parseVec3(
  value: unknown,
  itemPath: string,
  issues: MetadataIssue[],
  positive: boolean,
): Vec3 | undefined {
  if (!Array.isArray(value) || value.length !== 3) {
    issues.push({ severity: "error", message: "Expected a 3-element numeric array.", path: itemPath });
    return undefined;
  }
  const parsed = value.map(Number);
  const invalid = parsed.some((x) => !Number.isFinite(x) || (positive && x <= 0));
  if (invalid) {
    issues.push({
      severity: "error",
      message: positive ? "Expected positive finite numbers." : "Expected finite numbers.",
      path: itemPath,
    });
    return undefined;
  }
  return [parsed[0], parsed[1], parsed[2]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function path(prefix: string, key: string) {
  return prefix.length === 0 ? key : `${prefix}.${key}`;
}