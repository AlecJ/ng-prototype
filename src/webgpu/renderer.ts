import type { VolumeDataType } from "../client/viewerTypes";
import type { DecodedChunk } from "../precomputed/decode";

export interface ChunkRenderData {
	texture: GPUTexture;
	/** NDC X of the left edge of the chunk quad */
	ndcLeft: number;
	/** NDC X of the right edge */
	ndcRight: number;
	/** NDC Y of the top edge (larger value, WebGPU Y-up) */
	ndcTop: number;
	/** NDC Y of the bottom edge (smaller value) */
	ndcBottom: number;
	/** U at the left column of the visible region */
	uvMinX: number;
	/** U at the right column */
	uvMaxX: number;
	/**
	 * V at the top row of the visible Z slice.
	 * For JPEG/PNG the texture is (chunkW × chunkH*D); a single Z slice occupies
	 * rows [iz*chunkH, (iz+1)*chunkH).  Pass iz/D here.
	 */
	uvMinY: number;
	/** V at the bottom row of the visible Z slice: (iz+1)/D */
	uvMaxY: number;
}

// ---------------------------------------------------------------------------
// WGSL shader – one shared module for vertex + fragment stages.
// Uniforms layout (32 bytes = 4 × vec2f):
//   offset  0: ndcMin (left, bottom) in NDC
//   offset  8: ndcMax (right, top)   in NDC
//   offset 16: uvMin  (u0, v0)
//   offset 24: uvMax  (u1, v1)
// ---------------------------------------------------------------------------
const SHADER = /* wgsl */ `
struct Uni {
  ndcMin : vec2f,
  ndcMax : vec2f,
  uvMin  : vec2f,
  uvMax  : vec2f,
}

@group(0) @binding(0) var<uniform> u   : Uni;
@group(0) @binding(1) var          tex : texture_2d<f32>;
@group(0) @binding(2) var          smp : sampler;

struct VOut {
  @builtin(position) pos : vec4f,
  @location(0)       uv  : vec2f,
}

// Triangle-strip quad: 4 vertices
// index 0 = top-left,  1 = top-right
// index 2 = bot-left,  3 = bot-right
@vertex fn vs(@builtin(vertex_index) i : u32) -> VOut {
  let p = array<vec2f, 4>(
    vec2f(u.ndcMin.x, u.ndcMax.y),
    vec2f(u.ndcMax.x, u.ndcMax.y),
    vec2f(u.ndcMin.x, u.ndcMin.y),
    vec2f(u.ndcMax.x, u.ndcMin.y),
  );
  // UV origin (0,0) is top-left of texture; V increases downward.
  // Top vertices → uvMin.y, bottom vertices → uvMax.y.
  let uv = array<vec2f, 4>(
    vec2f(u.uvMin.x, u.uvMin.y),
    vec2f(u.uvMax.x, u.uvMin.y),
    vec2f(u.uvMin.x, u.uvMax.y),
    vec2f(u.uvMax.x, u.uvMax.y),
  );
  return VOut(vec4f(p[i], 0.0, 1.0), uv[i]);
}

@fragment fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  let s = textureSample(tex, smp, uv);
  // Luminance weights – correct for both grayscale (R=G=B) and colour.
  let lum = dot(s.rgb, vec3f(0.299, 0.587, 0.114));
  return vec4f(lum, lum, lum, 1.0);
}
`;

export class WebGpuRenderer {
	private device: GPUDevice | undefined;
	private context: GPUCanvasContext | undefined;
	private format: GPUTextureFormat | undefined;
	private pipeline: GPURenderPipeline | undefined;
	private sampler: GPUSampler | undefined;

	async initialize(canvas: OffscreenCanvas): Promise<void> {
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("Unable to acquire a WebGPU adapter.");
		this.device = await adapter.requestDevice();
		const context = canvas.getContext("webgpu");
		if (!context)
			throw new Error("Unable to acquire a WebGPU canvas context.");
		this.context = context;
		this.format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({
			device: this.device,
			format: this.format,
			alphaMode: "opaque",
		});

		const shaderModule = this.device.createShaderModule({ code: SHADER });
		this.pipeline = this.device.createRenderPipeline({
			layout: "auto",
			vertex: { module: shaderModule, entryPoint: "vs" },
			fragment: {
				module: shaderModule,
				entryPoint: "fs",
				targets: [{ format: this.format }],
			},
			primitive: {
				topology: "triangle-strip",
				stripIndexFormat: "uint32",
			},
		});
		this.sampler = this.device.createSampler({
			magFilter: "linear",
			minFilter: "linear",
		});
	}

	/**
	 * Upload a decoded chunk to the GPU and return the resulting texture.
	 *
	 * Layout convention (matches precomputed spec for JPEG/PNG):
	 *   texture width  = chunkSize[0]
	 *   texture height = chunkSize[1] * chunkSize[2]   (Z slices stacked vertically)
	 *
	 * Returns null when the renderer is not yet initialized.
	 */
	async uploadChunk(
		decoded: DecodedChunk,
		chunkDepth: number,
		dataType: VolumeDataType,
		numChannels: number,
	): Promise<{
		texture: GPUTexture;
		gpuBytes: number;
		textureDepth: number;
	} | null> {
		if (!this.device) return null;
		const device = this.device;

		if (decoded.image) {
			// JPEG / PNG: the browser decoded an ImageBitmap of dimensions (chunkW, chunkH * D).
			const w = decoded.image.width;
			const h = decoded.image.height;
			const texture = device.createTexture({
				size: [w, h],
				format: "rgba8unorm",
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.COPY_DST |
					GPUTextureUsage.RENDER_ATTACHMENT,
			});
			device.queue.copyExternalImageToTexture(
				{ source: decoded.image, flipY: false },
				{ texture, colorSpace: "srgb" },
				[w, h],
			);
			return { texture, gpuBytes: w * h * 4, textureDepth: chunkDepth };
		}

		if (decoded.data) {
			// RAW: rearrange into a (chunkW × chunkH*D) rgba8unorm texture so that
			// the same UV math as JPEG applies.
			const [W, H, D] = decoded.size;
			const texW = W;
			const texH = H * D;
			const rgba = new Uint8Array(texW * texH * 4);

			if (dataType === "uint8" && numChannels === 1) {
				const src = decoded.data as Uint8Array;
				// Precomputed raw order: X fastest, then Y, then Z.
				for (let z = 0; z < D; z++) {
					for (let y = 0; y < H; y++) {
						for (let x = 0; x < W; x++) {
							const v = src[x + y * W + z * W * H] ?? 0;
							const dst = (x + (y + z * H) * texW) * 4;
							rgba[dst] = v;
							rgba[dst + 1] = v;
							rgba[dst + 2] = v;
							rgba[dst + 3] = 255;
						}
					}
				}
			} else {
				// Unsupported data type / channel count — fill with mid-grey as placeholder.
				rgba.fill(128);
			}

			const texture = device.createTexture({
				size: [texW, texH],
				format: "rgba8unorm",
				usage:
					GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
			});
			device.queue.writeTexture(
				{ texture },
				rgba,
				{ bytesPerRow: texW * 4 },
				[texW, texH],
			);
			return { texture, gpuBytes: texW * texH * 4, textureDepth: D };
		}

		throw new Error("Decoded chunk has neither image nor data.");
	}

	/**
	 * Clear the canvas and draw all visible chunks.
	 * Pass an empty array to render only the background.
	 */
	render(
		chunks: ChunkRenderData[] = [],
		clearColor: GPUColor = { r: 0.05, g: 0.06, b: 0.07, a: 1 },
	): void {
		if (!this.device || !this.context || !this.pipeline || !this.sampler)
			return;
		const device = this.device;

		const encoder = device.createCommandEncoder();
		const view = this.context.getCurrentTexture().createView();
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view,
					clearValue: clearColor,
					loadOp: "clear",
					storeOp: "store",
				},
			],
		});

		pass.setPipeline(this.pipeline);

		const tempBuffers: GPUBuffer[] = [];

		for (const c of chunks) {
			// 32-byte uniform: ndcMin, ndcMax, uvMin, uvMax (each vec2f = 8 bytes)
			const uniData = new Float32Array([
				c.ndcLeft,
				c.ndcBottom, // ndcMin
				c.ndcRight,
				c.ndcTop, // ndcMax
				c.uvMinX,
				c.uvMinY, // uvMin
				c.uvMaxX,
				c.uvMaxY, // uvMax
			]);
			const uniBuffer = device.createBuffer({
				size: uniData.byteLength,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
			device.queue.writeBuffer(uniBuffer, 0, uniData);
			tempBuffers.push(uniBuffer);

			const bindGroup = device.createBindGroup({
				layout: this.pipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: uniBuffer } },
					{ binding: 1, resource: c.texture.createView() },
					{ binding: 2, resource: this.sampler },
				],
			});

			pass.setBindGroup(0, bindGroup);
			pass.draw(4); // triangle-strip → 2 triangles → 1 quad
		}

		pass.end();
		device.queue.submit([encoder.finish()]);

		// Destroy the per-frame uniform buffers once the GPU is done with them.
		void device.queue.onSubmittedWorkDone().then(() => {
			for (const buf of tempBuffers) buf.destroy();
		});
	}
}
