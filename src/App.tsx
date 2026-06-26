import { useEffect, useMemo, useRef, useState } from "react";
import { WorkerViewerEngine } from "./client/WorkerViewerEngine";
import { applyWheelInteraction, panCenter } from "./client/interactions";
import {
  defaultResourceSettings,
  formatBytes,
  normalizeResourceSettings,
} from "./client/resourceSettings";
import { parseUrlState, replaceUrlState } from "./client/urlState";
import type {
  MetadataIssue,
  RenderStats,
  ResourceStats,
  Vec3,
  ViewerEvent,
  ViewportState,
} from "./client/viewerTypes";
import { SettingsPanel } from "./settings/SettingsPanel";
import { ViewportCanvas } from "./viewer/ViewportCanvas";

const sampleSource = "gs://neuroglancer-public-data/flyem_fib-25/image";
const canvasCssSize = { width: 960, height: 640 };

type LoadState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "loaded"; scaleKey: string }
  | { type: "error"; message: string };

export function App() {
  const initial = parseUrlState();
  const engineRef = useRef<WorkerViewerEngine | undefined>(undefined);
  const disposeTimerRef = useRef<number | undefined>(undefined);
  if (!engineRef.current || engineRef.current.isDisposed) {
    engineRef.current = new WorkerViewerEngine();
  }
  const engine = engineRef.current;
  const [source, setSource] = useState(initial?.source || sampleSource);
  const [center, setCenter] = useState<Vec3>(initial?.center ?? [0, 0, 0]);
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [settings, setSettings] = useState(defaultResourceSettings);
  const [issues, setIssues] = useState<MetadataIssue[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loadState, setLoadState] = useState<LoadState>({ type: "idle" });
  const [renderStats, setRenderStats] = useState<RenderStats | undefined>();
  const [resourceStats, setResourceStats] = useState<ResourceStats | undefined>();
  const dragState = useRef<{ x: number; y: number } | undefined>(undefined);
  const resourceLimits = useMemo(() => normalizeResourceSettings(settings), [settings]);
  const viewport: ViewportState = useMemo(
    () => ({ center, zoom, canvasCssSize, devicePixelRatio: window.devicePixelRatio || 1 }),
    [center, zoom],
  );

  useEffect(() => {
    return engine.subscribe((event: ViewerEvent) => {
      if (event.type === "metadataIssues") setIssues(event.issues);
      if (event.type === "error") {
        setError(event.message);
        setLoadState({ type: "error", message: event.message });
      }
      if (event.type === "renderStats") setRenderStats(event.stats);
      if (event.type === "resourceStats") setResourceStats(event.stats);
      if (event.type === "sourceLoaded") {
        setError(undefined);
        const firstScale = event.source.metadata.scales[0];
        setLoadState({ type: "loaded", scaleKey: firstScale.key });
        setCenter((current) => {
          if (current.some((value) => value !== 0)) return current;
          return [
            firstScale.voxelOffset[0] + firstScale.size[0] / 2,
            firstScale.voxelOffset[1] + firstScale.size[1] / 2,
            firstScale.voxelOffset[2] + firstScale.size[2] / 2,
          ];
        });
      }
    });
  }, [engine]);

  useEffect(() => {
    if (disposeTimerRef.current !== undefined) {
      window.clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = undefined;
    }
    return () => {
      disposeTimerRef.current = window.setTimeout(() => {
        engine.dispose();
        if (engineRef.current === engine) engineRef.current = undefined;
      }, 0);
    };
  }, [engine]);

  useEffect(() => {
    replaceUrlState({ source, center, zoom });
  }, [source, center, zoom]);

  function loadSource(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (source.trim().length === 0) {
      const message = "Enter a public precomputed image source before loading.";
      setError(message);
      setLoadState({ type: "error", message });
      return;
    }
    setIssues([]);
    setError(undefined);
    setLoadState({ type: "loading" });
    void engine.setSource(source);
  }

  return (
    <main className="app-shell">
      <form className="top-bar" onSubmit={loadSource}>
        <label className="field source-field">
          <span>Source</span>
          <input
            value={source}
            onChange={(event) => {
              setSource(event.currentTarget.value);
              setLoadState({ type: "idle" });
            }}
          />
        </label>
        <button type="submit" disabled={loadState.type === "loading"}>
          {loadState.type === "loading" ? "Loading..." : "Load"}
        </button>
        <span className={`load-status load-status-${loadState.type}`} aria-live="polite">
          {loadStatusText(loadState)}
        </span>
      </form>
      <div className="workspace">
        <section className="viewer-panel">
          <ViewportCanvas
            engine={engine}
            viewport={viewport}
            resourceLimits={resourceLimits}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragState.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerMove={(event) => {
              if (!dragState.current) return;
              const deltaX = event.clientX - dragState.current.x;
              const deltaY = event.clientY - dragState.current.y;
              dragState.current = { x: event.clientX, y: event.clientY };
              setCenter((current) => panCenter(current, zoom, deltaX, deltaY));
            }}
            onPointerUp={() => {
              dragState.current = undefined;
            }}
            onWheel={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const next = applyWheelInteraction(viewport, event.nativeEvent, rect);
              setCenter(next.center);
              setZoom(next.zoom);
            }}
          />
        </section>
        <aside className="side-panel">
          <SettingsPanel value={settings} onChange={setSettings} />
          <section className="panel status-panel">
            <h2>Status</h2>
            <dl>
              <dt>Center</dt>
              <dd>{center.map((value) => value.toFixed(1)).join(", ")}</dd>
              <dt>Zoom</dt>
              <dd>{zoom.toFixed(4)}</dd>
              <dt>Scale</dt>
              <dd>{renderStats?.selectedScaleKey ?? "-"}</dd>
              <dt>Visible chunks</dt>
              <dd>{renderStats?.visibleChunkCount ?? 0}</dd>
              <dt>GPU memory</dt>
              <dd>{formatBytes(resourceStats?.residentGpuBytes ?? 0)}</dd>
              <dt>CPU memory</dt>
              <dd>{formatBytes(resourceStats?.residentCpuBytes ?? 0)}</dd>
              <dt>Requests</dt>
              <dd>{resourceStats ? `${resourceStats.activeRequestCount} active, ${resourceStats.pendingRequestCount} queued` : "0 active, 0 queued"}</dd>
            </dl>
          </section>
          {issues.length > 0 ? (
            <section className="panel issue-panel">
              <h2>Metadata</h2>
              {issues.map((issue, index) => (
                <p key={`${issue.path ?? "issue"}-${index}`} className={issue.severity}>
                  {issue.path ? `${issue.path}: ` : ""}{issue.message}
                </p>
              ))}
            </section>
          ) : null}
          {error ? <section className="panel error-panel">{error}</section> : null}
        </aside>
      </div>
    </main>
  );
}

function loadStatusText(state: LoadState): string {
  switch (state.type) {
    case "idle":
      return "Ready";
    case "loading":
      return "Fetching metadata";
    case "loaded":
      return `Loaded ${state.scaleKey}`;
    case "error":
      return "Load failed";
  }
}