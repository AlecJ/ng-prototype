import type { Vec3 } from "./viewerTypes";

export interface UrlViewerState {
  source: string;
  center: Vec3;
  zoom: number;
}

const defaultCenter: Vec3 = [0, 0, 0];

export function parseUrlState(hash = globalThis.location?.hash ?? ""):
  | UrlViewerState
  | undefined {
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  if (text.length === 0) return undefined;
  const params = new URLSearchParams(text);
  const source = params.get("source") ?? "";
  const center = parseVec3(params.get("center")) ?? defaultCenter;
  const zoom = parsePositiveNumber(params.get("zoom")) ?? 1;
  return { source, center, zoom };
}

export function serializeUrlState(state: UrlViewerState): string {
  const params = new URLSearchParams();
  if (state.source.length !== 0) params.set("source", state.source);
  params.set("center", state.center.join(","));
  params.set("zoom", String(state.zoom));
  return `#${params.toString()}`;
}

export function replaceUrlState(state: UrlViewerState): void {
  const url = `${globalThis.location.pathname}${globalThis.location.search}${serializeUrlState(
    state,
  )}`;
  globalThis.history.replaceState(null, "", url);
}

function parseVec3(value: string | null): Vec3 | undefined {
  if (value === null) return undefined;
  const parts = value.split(",").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) {
    return undefined;
  }
  return [parts[0], parts[1], parts[2]];
}

function parsePositiveNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}