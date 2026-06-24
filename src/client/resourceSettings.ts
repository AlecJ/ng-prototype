import type { ResourceLimits } from "./viewerTypes";

const mib = 1024 * 1024;

export interface ResourceSettingsFormValue {
  gpuMemoryLimitMiB: number;
  systemMemoryLimitMiB: number;
  concurrentChunkRequests: number;
}

export const defaultResourceSettings: ResourceSettingsFormValue = {
  gpuMemoryLimitMiB: 512,
  systemMemoryLimitMiB: 512,
  concurrentChunkRequests: 8,
};

export function normalizeResourceSettings(
  value: ResourceSettingsFormValue,
): ResourceLimits {
  return {
    gpuMemoryLimitBytes: Math.max(16, value.gpuMemoryLimitMiB) * mib,
    systemMemoryLimitBytes: Math.max(16, value.systemMemoryLimitMiB) * mib,
    concurrentChunkRequests: Math.max(
      1,
      Math.min(64, Math.floor(value.concurrentChunkRequests)),
    ),
  };
}

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / mib)} MiB`;
}