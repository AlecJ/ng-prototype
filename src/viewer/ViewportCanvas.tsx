import { useEffect, useMemo, useRef } from "react";
import type { ViewerEngine } from "../client/ViewerEngine";
import type { ResourceLimits, ViewportState } from "../client/viewerTypes";

interface Props {
  engine: ViewerEngine;
  viewport: ViewportState;
  resourceLimits: ResourceLimits;
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
}

export function ViewportCanvas({
  engine,
  viewport,
  resourceLimits,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSize = useMemo(() => viewport.canvasCssSize, [viewport.canvasCssSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void engine.attachCanvas(canvas);
  }, [engine]);

  useEffect(() => {
    engine.setViewport(viewport);
  }, [engine, viewport]);

  useEffect(() => {
    engine.setResourceLimits(resourceLimits);
  }, [engine, resourceLimits]);

  return (
    <canvas
      ref={canvasRef}
      className="viewer-canvas"
      width={Math.max(1, Math.floor(canvasSize.width * viewport.devicePixelRatio))}
      height={Math.max(1, Math.floor(canvasSize.height * viewport.devicePixelRatio))}
      style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}