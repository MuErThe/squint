"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { GestureState } from "@/lib/hand/types";

export type CameraStatus =
  | "init"
  | "requesting"
  | "warming"
  | "ready"
  | "paused"
  | "failed";

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
    const overlayStopRef = useRef<(() => void) | null>(null);
    const statusRef = useRef<CameraStatus>("init");
    /** Latched after a successful boot — drives auto-resume on tab return. */
    const wantTrackingRef = useRef(false);
    const [status, setStatus] = useState<CameraStatus>("init");

    const setStatusBoth = useCallback(
      (s: CameraStatus) => {
        statusRef.current = s;
        setStatus(s);
        onStatusChange?.(s);
      },
      [onStatusChange],
    );

    /** Drop all live gesture flags so a stopped tracker can't keep steering. */
    const clearLiveGesture = useCallback(() => {
      const g = gestureRef.current;
      g.handVisible = false;
      g.rawLandmarks = null;
      g.pinchActive = false;
      g.pinchRisingEdge = false;
      g.dropZoneActive = false;
      g.confidence = 0;
    }, [gestureRef]);

    const stopTracking = useCallback(() => {
      trackerStopRef.current?.();
      trackerStopRef.current = null;
      clearLiveGesture();
    }, [clearLiveGesture]);

    const startTracking = useCallback(async (): Promise<{
      ok: boolean;
      error?: string;
    }> => {
      const video = videoRef.current;
      if (!video) {
        return { ok: false, error: "video element not mounted" };
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return {
          ok: false,
          error:
            "this browser doesn't expose mediaDevices.getUserMedia (need HTTPS or localhost)",
        };
      }
      try {
        const { bootHandTracker } = await import("@/lib/hand/tracker");
        const { onHandResults, attachOverlayLoop, resetGestureTracking } =
          await import("@/lib/hand/gestures");
        resetGestureTracking();
        clearLiveGesture();
        const stop = await bootHandTracker(video, (results) => {
          // First inference marks the model warm — before that the camera is
          // live but gestures can't register yet.
          if (statusRef.current === "warming") setStatusBoth("ready");
          onHandResults(results, gestureRef, movementFreezeUntilRef);
        });
        trackerStopRef.current = stop;
        if (overlayRef.current && !overlayStopRef.current) {
          overlayStopRef.current = attachOverlayLoop(
            overlayRef.current,
            video,
            gestureRef,
          );
        }
        setStatusBoth("warming");
        return { ok: true };
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[VisionFeed] boot failed", err);
        }
        const e = err as { name?: string; message?: string };
        let msg = e?.message ?? "unknown error";
        if (e?.name === "NotAllowedError") msg = "camera permission denied";
        if (e?.name === "NotFoundError") msg = "no camera detected";
        if (e?.name === "NotReadableError")
          msg = "camera is in use by another app";
        return { ok: false, error: msg };
      }
    }, [clearLiveGesture, gestureRef, movementFreezeUntilRef, setStatusBoth]);

    useImperativeHandle(ref, () => ({
      boot: async () => {
        if (statusRef.current === "ready" || statusRef.current === "warming") {
          return { ok: true };
        }
        setStatusBoth("requesting");
        const result = await startTracking();
        if (result.ok) {
          wantTrackingRef.current = true;
        } else {
          setStatusBoth("failed");
        }
        return result;
      },
    }));

    // Camera lifecycle: release the webcam whenever the tab is hidden (the
    // light goes off), restart it on return, and always stop on page hide /
    // unmount so the stream can't outlive the game.
    useEffect(() => {
      const onVisibility = () => {
        if (document.hidden) {
          if (trackerStopRef.current) {
            stopTracking();
            setStatusBoth("paused");
          }
        } else if (
          wantTrackingRef.current &&
          statusRef.current === "paused"
        ) {
          setStatusBoth("requesting");
          void startTracking().then((res) => {
            if (!res.ok) setStatusBoth("failed");
          });
        }
      };
      const onPageHide = () => stopTracking();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", onPageHide);
      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", onPageHide);
        overlayStopRef.current?.();
        overlayStopRef.current = null;
        stopTracking();
      };
    }, [setStatusBoth, startTracking, stopTracking]);

    // D toggles the tracking debug overlay (landmarks always show; this adds
    // confidence / fps / gesture-state diagnostics). Off by default.
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
        )
          return;
        if (e.key.toLowerCase() === "d") {
          void import("@/lib/hand/gestures").then((m) =>
            m.toggleDebugOverlay(),
          );
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
      <div
        className="relative w-full h-full rounded-[2px] overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.35)",
          boxShadow: "inset 0 0 0 1px rgba(245,182,81,0.08)",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full"
          style={{ transform: "scaleX(-1)", objectFit: "cover" }}
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Edge vignette so panel chrome blends in */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 70%, rgba(0,0,0,0.4) 100%)",
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
    case "warming":
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
    case "warming":
      return "loading model…";
    case "paused":
      return "paused";
    case "failed":
      return "offline";
    default:
      return "idle";
  }
}
