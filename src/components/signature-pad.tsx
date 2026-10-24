"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
}

/**
 * Zone de signature tactile/souris, sans dépendance. Trait navy sur fond
 * transparent (export PNG), dimensionnée au conteneur (×devicePixelRatio
 * pour rester nette sur mobile). Le parent pilote via la ref :
 * `clear()`, `isEmpty()`, `toBlob()`.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#12324f";
      }
    }, []);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.setPointerCapture(e.pointerId);
      drawing.current = true;
      const { x, y } = point(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = point(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      dirty.current = true;
    };

    const end = () => {
      drawing.current = false;
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        dirty.current = false;
      },
      isEmpty: () => !dirty.current,
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) return resolve(null);
          canvas.toBlob((b) => resolve(b), "image/png");
        }),
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className={cn(
          "h-44 w-full touch-none rounded-[14px] border-[1.5px] border-dashed border-border bg-card",
          className,
        )}
      />
    );
  },
);
