"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SignatureCapture } from "@/types/repair-workflow";

export type SignaturePadProps = {
  value: SignatureCapture;
  onChange: (next: SignatureCapture) => void;
  className?: string;
};

const STROKE = "#e4e4e7";
const BG = "#09090b";
const CSS_H = 200;

export function SignaturePad({ value, onChange, className = "" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const stroked = useRef(false);

  const setupContext = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, parent.clientWidth);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(CSS_H * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${CSS_H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, CSS_H);
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return { ctx, w, cssH: CSS_H };
  }, []);

  const loadDataUrl = useCallback(
    (dataUrl: string) => {
      const meta = setupContext();
      const canvas = canvasRef.current;
      if (!meta || !canvas) return;
      const { ctx, w, cssH } = meta;
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, cssH);
        ctx.drawImage(img, 0, 0, w, cssH);
        stroked.current = true;
      };
      img.src = dataUrl;
    },
    [setupContext],
  );

  useEffect(() => {
    if (value.mode === "drawn" && value.dataUrl) {
      loadDataUrl(value.dataUrl);
    } else {
      setupContext();
      stroked.current = false;
    }
  }, [loadDataUrl, setupContext, value.dataUrl, value.mode]);

  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      if (value.mode === "drawn" && value.dataUrl) loadDataUrl(value.dataUrl);
      else setupContext();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [loadDataUrl, setupContext, value.dataUrl, value.mode]);

  const pos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = pos(e);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !last.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      stroked.current = true;
    },
    [pos],
  );

  const finishStroke = useCallback(() => {
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !stroked.current) return;
    onChange({
      mode: "drawn",
      dataUrl: canvas.toDataURL("image/png"),
      typedFullName: null,
    });
  }, [onChange]);

  const clear = useCallback(() => {
    stroked.current = false;
    setupContext();
    onChange({
      mode: "drawn",
      dataUrl: null,
      typedFullName: null,
    });
  }, [onChange, setupContext]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 ring-1 ring-zinc-800">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          role="img"
          aria-label="Sign here"
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="touch-pad min-h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 text-sm font-semibold text-zinc-300 active:bg-zinc-800"
      >
        Clear signature
      </button>
      <p className="text-xs text-zinc-500">
        Draw with finger or stylus. Release to save the stroke to the ticket.
      </p>
    </div>
  );
}
