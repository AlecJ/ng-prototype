import type { Vec3 } from "../client/viewerTypes";
import type { VisibleChunk } from "./chunkSelection";

export function buildUnshardedChunkUrl(baseUrl: string, chunk: VisibleChunk): string {
  const [x0, y0, z0] = chunk.voxelStart;
  const [x1, y1, z1] = chunk.voxelEnd;
  return `${baseUrl}/${chunk.scale.key}/${x0}-${x1}_${y0}-${y1}_${z0}-${z1}`;
}

export function encodeZIndexCompressed3d(
  xBits: number,
  yBits: number,
  zBits: number,
  position: Vec3,
): bigint {
  const maxBits = Math.max(xBits, yBits, zBits);
  let outputBit = 0n;
  let zIndex = 0n;
  const writeBit = (bit: number) => {
    zIndex |= BigInt(bit & 1) << outputBit;
    outputBit += 1n;
  };
  for (let bit = 0; bit < maxBits; bit += 1) {
    if (bit < xBits) writeBit(position[0] >> bit);
    if (bit < yBits) writeBit(position[1] >> bit);
    if (bit < zBits) writeBit(position[2] >> bit);
  }
  return zIndex;
}