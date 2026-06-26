# Neuroglancer WebGPU Prototype Implementation Plan

This document summarizes the plan implemented in the React/WebGPU prototype and the intended next steps. It is written as a handoff for co-author review.

## Goal

Build an independent Neuroglancer-inspired prototype for viewing precomputed image volume data with a React frontend and a WebGPU-backed visualization pipeline.

The prototype is intentionally narrow:

- Load one precomputed image volume source.
- Support x/y plane viewing only.
- Do not support segmentation, multiple layers, meshes, annotations, 3D perspective, or off-axis rotation.
- Store only source, center point, and zoom in the URL.
- Use scroll wheel for z navigation.
- Use Ctrl + scroll for cursor-centered zoom.
- Keep frontend UX code decoupled from chunk loading and visualization internals.
- Avoid importing or depending on the existing Neuroglancer source tree.

## Architecture

React is the first UI implementation, but it is not the visualization boundary. The stable boundary is the framework-neutral `ViewerEngine` API in `src/client/ViewerEngine.ts`.

The high-level flow is:

1. React owns form controls, source input, settings UI, pointer/wheel interactions, status display, and URL synchronization.
2. React sends source, viewport, and resource settings through the `ViewerEngine` interface.
3. `WorkerViewerEngine` runs on the main thread and owns source normalization, metadata fetch, metadata validation, worker creation, canvas transfer, and event translation.
4. The worker receives only validated source metadata and viewport/resource settings.
5. The worker calculates visible chunks from the viewport, fetches/decompresses chunks, accounts for CPU/GPU residency, and owns WebGPU rendering.

This keeps alternate frontend implementations possible: another UI can use `WorkerViewerEngine` without importing React components, worker internals, chunking modules, or WebGPU renderer code.

## Implemented Pieces

### Project Scaffold

- Created an independent Vite + React + TypeScript app in `prototype/`.
- Wrote a fresh Vite config rather than adapting the existing Neuroglancer config.
- Added scripts for development, type checking, testing, boundary checks, and production builds.

### Framework-Neutral Client API

- Added shared types in `src/client/viewerTypes.ts`.
- Added the public `ViewerEngine` contract in `src/client/ViewerEngine.ts`.
- Added `WorkerViewerEngine` as the default adapter from frontend state to worker protocol.

The engine interface covers:

- Canvas attachment.
- Source loading.
- Viewport updates.
- Resource-limit updates.
- Typed event subscription.
- Disposal.

### Source Normalization and Metadata Validation

- Added source normalization in `src/client/precomputed/sourceUrl.ts`.
- Supports public `gs://` roots by converting them to `https://storage.googleapis.com/...`.
- Supports direct `http://` and `https://` precomputed roots.
- Strips the `|neuroglancer-precomputed:` suffix when present.
- Added frontend-side metadata validation in `src/client/precomputed/metadata.ts`.
- Requires `type: image` and rejects segmentation sources.
- Parses image metadata fields needed for chunk selection: data type, channels, scales, encoding, resolution, voxel offset, size, chunk size, and optional sharding metadata.
- Emits metadata warnings/errors before the worker receives source state.

### React UI

- Added source input and Load control.
- Added visible load states: ready, fetching metadata, loaded, and failed.
- Added a single canvas viewer host.
- Added a settings panel for resource controls.
- Added status and metadata issue panels.
- Added URL-backed source, center, and zoom state.
- Fixed React StrictMode development behavior so the viewer engine is not disposed before Load is clicked.

### Interactions

- Drag pans the x/y center.
- Wheel without Ctrl changes the z coordinate.
- Ctrl + wheel performs cursor-centered zoom.
- Interaction math is implemented in plain TypeScript in `src/client/interactions.ts` so it can be reused outside React.

### Worker and Visualization Scaffold

- Added a typed worker protocol in `src/worker/protocol.ts`.
- Added worker orchestration in `src/worker/renderWorker.ts`.
- Added visible chunk selection in `src/precomputed/chunkSelection.ts`.
- Added unsharded chunk URL generation in `src/precomputed/chunkFetch.ts`.
- Added image chunk decode adapters in `src/precomputed/decode.ts`.
- Added request scheduling in `src/worker/chunkScheduler.ts`.
- Added CPU/GPU cache accounting and eviction scaffolding in `src/worker/chunkCache.ts`.
- Added WebGPU canvas initialization and clear rendering in `src/webgpu/renderer.ts`.

The worker currently selects and fetches chunks, decodes image data through first-pass adapters, accounts for memory, and reports render/resource stats. Full chunk texture upload and drawing are still the next major rendering milestone.

### Boundary Enforcement

- Added `scripts/check-boundaries.mjs`.
- Ensures the prototype does not import from Neuroglancer.
- Ensures React-facing code does not directly import worker, precomputed worker-side, decoder, cache, scheduler, or WebGPU implementation modules.

## Important Decisions

- The prototype backend is a browser Worker, not a separate Node/server process.
- WebGPU ownership lives behind the worker/engine boundary.
- The frontend sends viewport settings; the worker calculates visible chunks.
- Metadata fetch and validation live in the frontend-side engine API boundary, before worker handoff.
- Source data is image volume only; segmentation is intentionally rejected.
- URL state is intentionally limited to source, center, and zoom.
- Resource settings are session-local, not URL-backed.
- No existing Neuroglancer source is imported; needed behavior is reimplemented locally.

## Verification

The following commands passed from `prototype/`:

```sh
npm run typecheck
npm run test
npm run lint:boundaries
npm run build
```

Current unit coverage includes:

- Source URL normalization.
- Metadata validation.
- Interaction math.
- Chunk selection.
- Unsharded chunk URL generation.
- Chunk scheduler concurrency.
- Chunk cache accounting/eviction behavior.

## Known Limitations

- WebGPU currently initializes and clears the canvas, but does not yet render decoded chunk textures.
- Render stats currently report selected/visible chunks, but rendered chunk count remains a scaffold value.
- Sharded precomputed chunks are detected but not implemented yet.
- The decoder path is a first milestone scaffold and needs validation against real dataset chunks.
- No authentication/private GCS support is implemented.
- No alternate frontend has been built yet, though the boundary is designed for it.

## Recommended Next Milestones

1. Implement actual WebGPU texture upload for decoded image chunks.
2. Draw visible chunk quads in x/y viewport coordinates with a simple grayscale shader.
3. Validate JPEG chunk decoding against the hemibrain sample source.
4. Add sharded precomputed chunk reads from the precomputed sharding specification.
5. Add request cancellation or stale-result filtering for rapid viewport/source changes.
6. Add a non-React smoke harness or test that uses `WorkerViewerEngine` directly.
7. Add browser-level verification for Load, metadata requests, chunk requests, and nonblank canvas rendering.
8. Add more precise resource-limit tests for GPU texture destruction once real textures are created.

## Main Files

- `src/client/ViewerEngine.ts`: public frontend/engine contract.
- `src/client/WorkerViewerEngine.ts`: default main-thread engine adapter.
- `src/client/viewerTypes.ts`: shared public types.
- `src/client/precomputed/sourceUrl.ts`: source normalization.
- `src/client/precomputed/metadata.ts`: metadata validation.
- `src/client/urlState.ts`: URL state parsing and serialization.
- `src/client/interactions.ts`: pan, z-scroll, and cursor-centered zoom math.
- `src/App.tsx`: React UI shell.
- `src/viewer/ViewportCanvas.tsx`: React canvas host.
- `src/settings/SettingsPanel.tsx`: resource controls.
- `src/worker/protocol.ts`: main/worker message protocol.
- `src/worker/renderWorker.ts`: worker orchestration.
- `src/worker/chunkScheduler.ts`: request concurrency scheduler.
- `src/worker/chunkCache.ts`: CPU/GPU resource accounting.
- `src/precomputed/chunkSelection.ts`: viewport-to-chunk selection.
- `src/precomputed/chunkFetch.ts`: unsharded chunk URL generation.
- `src/precomputed/decode.ts`: image decode adapters.
- `src/webgpu/renderer.ts`: WebGPU renderer scaffold.
- `scripts/check-boundaries.mjs`: architecture boundary checks.
