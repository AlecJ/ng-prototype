# Neuroglancer WebGPU Prototype

This is an independent Vite React prototype for a WebGPU-backed, x/y-plane-only precomputed image volume viewer.

## Run

```sh
npm install
npm run dev-server
```

Use a browser with WebGPU and OffscreenCanvas support.

## Scope

- One precomputed image layer only.
- Public `gs://`, `http://`, and `https://` precomputed roots.
- Frontend-side source normalization and metadata validation inside the `ViewerEngine` API boundary.
- Worker-side chunk selection, chunk download/decode scaffolding, resource scheduling, cache accounting, and WebGPU rendering.
- Drag pans x/y.
- Wheel changes z.
- Ctrl + wheel performs cursor-centered zoom.
- URL state stores only source, center, and zoom.

## Architecture

React is the first UI, but not the visualization boundary. Frontends interact with `src/client/ViewerEngine.ts`. The default `WorkerViewerEngine` validates metadata before sending normalized source metadata to the worker. React components must not import worker, precomputed worker-side, decoder, cache, scheduler, or WebGPU modules directly.

The prototype intentionally does not depend on the local Neuroglancer package. Required precomputed behavior is re-implemented locally from the format behavior.

## Verify

```sh
npm run typecheck
npm run test
npm run lint:boundaries
npm run build
```