import type { PrecomputedScaleMetadata, Vec3, ViewportState } from "../client/viewerTypes";

export interface VisibleChunk {
  key: string;
  scale: PrecomputedScaleMetadata;
  gridPosition: Vec3;
  voxelStart: Vec3;
  voxelEnd: Vec3;
}

export interface ChunkSelectionResult {
  scale: PrecomputedScaleMetadata;
  chunks: VisibleChunk[];
}

export function selectVisibleChunks(
  scales: PrecomputedScaleMetadata[],
  viewport: ViewportState,
): ChunkSelectionResult {
  const scale = chooseScale(scales, viewport.zoom);
  const [centerX, centerY, centerZ] = viewport.center;
  const halfWidth = (viewport.canvasCssSize.width * viewport.zoom) / 2;
  const halfHeight = (viewport.canvasCssSize.height * viewport.zoom) / 2;
  const minX = Math.max(scale.voxelOffset[0], centerX - halfWidth);
  const maxX = Math.min(scale.voxelOffset[0] + scale.size[0], centerX + halfWidth);
  const minY = Math.max(scale.voxelOffset[1], centerY - halfHeight);
  const maxY = Math.min(scale.voxelOffset[1] + scale.size[1], centerY + halfHeight);
  const z = Math.max(
    scale.voxelOffset[2],
    Math.min(scale.voxelOffset[2] + scale.size[2] - 1, Math.floor(centerZ)),
  );
  const x0 = gridFloor(minX, scale.voxelOffset[0], scale.chunkSize[0]);
  const x1 = gridFloor(Math.max(minX, maxX - 1), scale.voxelOffset[0], scale.chunkSize[0]);
  const y0 = gridFloor(minY, scale.voxelOffset[1], scale.chunkSize[1]);
  const y1 = gridFloor(Math.max(minY, maxY - 1), scale.voxelOffset[1], scale.chunkSize[1]);
  const zGrid = gridFloor(z, scale.voxelOffset[2], scale.chunkSize[2]);
  const chunks: VisibleChunk[] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const voxelStart: Vec3 = [
        scale.voxelOffset[0] + x * scale.chunkSize[0],
        scale.voxelOffset[1] + y * scale.chunkSize[1],
        scale.voxelOffset[2] + zGrid * scale.chunkSize[2],
      ];
      const voxelEnd: Vec3 = [
        Math.min(voxelStart[0] + scale.chunkSize[0], scale.voxelOffset[0] + scale.size[0]),
        Math.min(voxelStart[1] + scale.chunkSize[1], scale.voxelOffset[1] + scale.size[1]),
        Math.min(voxelStart[2] + scale.chunkSize[2], scale.voxelOffset[2] + scale.size[2]),
      ];
      const gridPosition: Vec3 = [x, y, zGrid];
      chunks.push({
        key: `${scale.key}:${x}:${y}:${zGrid}`,
        scale,
        gridPosition,
        voxelStart,
        voxelEnd,
      });
    }
  }
  return { scale, chunks };
}

function chooseScale(scales: PrecomputedScaleMetadata[], zoom: number): PrecomputedScaleMetadata {
  return scales.reduce((best, scale) => {
    const bestDelta = Math.abs(best.resolution[0] - zoom);
    const delta = Math.abs(scale.resolution[0] - zoom);
    return delta < bestDelta ? scale : best;
  }, scales[0]);
}

function gridFloor(value: number, offset: number, chunkSize: number): number {
  return Math.max(0, Math.floor((value - offset) / chunkSize));
}