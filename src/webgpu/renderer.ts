export class WebGpuRenderer {
  private device: GPUDevice | undefined;
  private context: GPUCanvasContext | undefined;
  private format: GPUTextureFormat | undefined;

  async initialize(canvas: OffscreenCanvas): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("Unable to acquire a WebGPU adapter.");
    this.device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) throw new Error("Unable to acquire a WebGPU canvas context.");
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
  }

  render(clearColor: GPUColor = { r: 0.05, g: 0.06, b: 0.07, a: 1 }): void {
    if (!this.device || !this.context) return;
    const encoder = this.device.createCommandEncoder();
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
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}