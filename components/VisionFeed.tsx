"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { GestureState } from "@/lib/hand/types";

export type CameraStatus = "init" | "requesting" | "ready" | "failed";

interface VisionFeedProps {
  gestureRef: React.MutableRefObject<GestureState>;
  movementFreezeUntilRef: React.MutableRefObject<number>;
  onStatusChange?: (status: CameraStatus) => void;
}

export interface VisionFeedHandle {
  /** Request camera permission and start tracking. Resolves with success flag and message. */
  boot: () => Promise<{ ok: boolean; error?: string }>;
}

export const VisionFeed = forwardRef<VisionFeedHandle, VisionFeedProps>(
  function VisionFeed(
    { gestureRef, movementFreezeUntilRef, onStatusChange },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const trackerStopRef = useRef<(() => void) | null>(null);
    const [status, setStatus] = useState<CameraStatus>("init");
    const setStatusBoth = (s: CameraStatus) => {
      setStatus(s);
      onStatusChange?.(s);
    };

    useImperativeHandle(ref, () => ({
      boot: async () => {
        if (status === "ready") return { ok: true };
        setStatusBoth("requesting");
        const video = videoRef.current;
        if (!video) {
          setStatusBoth("failed");
          return { ok: false, error: "video element not mounted" };
        }
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setStatusBoth("failed");
          return {
            ok: false,
            error:
              "this browser doesn't expose mediaDevices.getUserMedia (need HTTPS or localhost)",
          };
        }
        try {
          const { bootHandTracker } = await import("@/lib/hand/tracker");
          const { onHandResults, attachOverlayLoop } = await import(
            "@/lib/hand/gestures"
          );
          const stop = await bootHandTracker(video, (results) => {
            onHandResults(results, gestureRef, movementFreezeUntilRef);
          });
          trackerStopRef.current = stop;
          if (overlayRef.current) {
            attachOverlayLoop(overlayRef.current, video, gestureRef);
          }
          setStatusBoth("ready");
          return { ok: true };
        } catch (err) {
          console.error("[VisionFeed] boot failed", err);
          setStatusBoth("failed");
          const e = err as { name?: string; message?: string };
          let msg = e?.message ?? "unknown error";
          if (e?.name === "NotAllowedError") msg = "camera permission denied";
          if (e?.name === "NotFoundError") msg = "no camera detected";
          if (e?.name === "NotReadableError")
            msg = "camera is in use by another app";
          return { ok: false, error: msg };
        }
      },
    }));

    return (
      <div
        className="relative w-full h-full rounded-[2px] overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.35)",
          boxShadow: "inset 0 0 0 1px rgba(245,182,81,0.08)",
        }}
      >
        {/* Inset wrapper that shrinks both the video and the overlay canvas
            equally, so the live feed reads more "zoomed out" without breaking
            the landmark <-> canvas coordinate mapping. */}
        <div className="absolute inset-[6%]">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full"
            style={{ transform: "scaleX(-1)", objectFit: "contain" }}
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>

        {/* Subtle inner border accent (corners) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* Status pill */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-[2px]"
          style={{
            background: "rgba(14,10,20,0.65)",
            backdropFilter: "blur(2px)",
            border: "1px solid var(--panel-border)",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: statusDot(status) }}
          />
          <span
            className="font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{ color: "var(--ink-dim)" }}
          >
            cam · {statusLabel(status)}
          </span>
        </div>

        {/* Init / failed message */}
        {(status === "init" || status === "failed") && (
          <div className="absolute inset-0 flex items-center justify-center text-center font-mono text-xs px-6">
            <div
              className="px-4 py-3 rounded-[2px] border max-w-[90%]"
              style={{
                background: "rgba(14,10,20,0.7)",
                borderColor: "var(--panel-border)",
                color: "var(--ink-dim)",
              }}
            >
              {status === "init"
                ? "press START to enable camera tracking"
                : "camera unavailable · keyboard fallback active"}
            </div>
          </div>
        )}
      </div>
    );
  },
);

function statusDot(s: CameraStatus): string {
  switch (s) {
    case "ready":
      return "var(--c-S)";
    case "requesting":
      return "var(--accent)";
    case "failed":
      return "var(--accent-hot)";
    default:
      return "var(--ink-dim)";
  }
}

function statusLabel(s: CameraStatus): string {
  switch (s) {
    case "ready":
      return "live";
    case "requesting":
      return "starting…";
    case "failed":
      return "offline";
    default:
      return "idle";
  }
}
