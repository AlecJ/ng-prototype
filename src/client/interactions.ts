import type { Vec3, ViewportState } from "./viewerTypes";

export interface WheelLike {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  clientX: number;
  clientY: number;
}

export interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const domDeltaPixel = 0;
const domDeltaLine = 1;
const domDeltaPage = 2;

export function wheelScale(event: Pick<WheelLike, "deltaMode" | "deltaY">) {
  let multiplier = 0;
  switch (event.deltaMode) {
    case domDeltaPixel:
      multiplier = 1 / 200;
      break;
    case domDeltaLine:
      multiplier = 1 / 10;
      break;
    case domDeltaPage:
      multiplier = 2;
      break;
  }
  return Math.exp(event.deltaY * multiplier);
}

export function wheelZDelta(event: Pick<WheelLike, "deltaMode" | "deltaY">) {
  const unit = event.deltaMode === domDeltaPixel ? 120 : 1;
  return Math.sign(event.deltaY) * Math.max(1, Math.ceil(Math.abs(event.deltaY) / unit));
}

export function panCenter(center: Vec3, zoom: number, deltaX: number, deltaY: number): Vec3 {
  return [center[0] - deltaX * zoom, center[1] - deltaY * zoom, center[2]];
}

export function applyWheelInteraction(
  viewport: ViewportState,
  event: WheelLike,
  rect: CanvasRectLike,
  zBounds?: { min: number; max: number },
): Pick<ViewportState, "center" | "zoom"> {
  if (!event.ctrlKey) {
    const nextZ = viewport.center[2] + wheelZDelta(event);
    const clampedZ = zBounds
      ? Math.max(zBounds.min, Math.min(zBounds.max, nextZ))
      : nextZ;
    return { center: [viewport.center[0], viewport.center[1], clampedZ], zoom: viewport.zoom };
  }

  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const offsetX = localX - rect.width / 2;
  const offsetY = localY - rect.height / 2;
  const newZoom = Math.max(1e-6, viewport.zoom * wheelScale(event));
  const voxelX = viewport.center[0] + offsetX * viewport.zoom;
  const voxelY = viewport.center[1] + offsetY * viewport.zoom;
  return {
    center: [voxelX - offsetX * newZoom, voxelY - offsetY * newZoom, viewport.center[2]],
    zoom: newZoom,
  };
}