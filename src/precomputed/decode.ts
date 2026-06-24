import type { ChunkEncoding, Vec3 } from "../client/viewerTypes";

export interface DecodedChunk {
  bytes: number;
  image?: ImageBitmap;
  data?: ArrayBufferView;
  size: Vec3;
}

export async function decodeChunk(
  encoding: ChunkEncoding,
  buffer: ArrayBuffer,
  size: Vec3,
): Promise<DecodedChunk> {
  if (encoding === "raw") {
    return { data: new Uint8Array(buffer), bytes: buffer.byteLength, size };
  }
  if (encoding === "jpeg" || encoding === "png") {
    const blob = new Blob([buffer], { type: encoding === "jpeg" ? "image/jpeg" : "image/png" });
    const image = await createImageBitmap(blob);
    return { image, bytes: image.width * image.height * 4, size };
  }
  throw new Error(`Unsupported chunk encoding for first implementation: ${encoding}`);
}