"use client";

import { useEffect, useRef } from "react";
import type { GameState, PieceType } from "../tetris/types";
import {
  hardDrop,
  softDrop,
  tick,
  tryMoveLeft,
  tryMoveRight,
  tryMoveTo,
  tryRotate,
} from "../tetris/engine";
import type { GestureState } from "../hand/types";

export interface UiSnapshot {
  score: number;
  lines: number;
  level: number;
  queue: PieceType[];
  isOver: boolean;
  current: PieceType | null;
  lockTick: number;
}

interface UseGameControllerOpts {
  gameRef: React.MutableRefObject<GameState>;
  gestureRef: React.MutableRefObject<GestureState>;
  movementFreezeUntilRef: React.MutableRefObject<number>;
  onUiUpdate: (snap: UiSnapshot) => void;
  /** Push score/lines/level updates at most every N ms. */
  uiThrottleMs?: number;
}

/**
 * The non-render half of the controller — keyboard, throttling, and a helper to
 * call once per frame from useFrame. The render-loop call is exported as
 * `stepGame` so we can keep this hook free of R3F.
 */
export function useGameController({
  gameRef,
  gestureRef,
  movementFreezeUntilRef,
  onUiUpdate,
  uiThrottleMs = 100,
}: UseGameControllerOpts) {
  const lastUiPushRef = useRef<number>(0);
  const lastLockTickRef = useRef<number>(-1);
  const lastOverRef = useRef<boolean>(false);
  const onUiUpdateRef = useRef(onUiUpdate);
  useEffect(() => {
    onUiUpdateRef.current = onUiUpdate;
  });

  // Keyboard input
  useEffect(() => {
    const held = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      const s = gameRef.current;
      if (s.isOver) return;
      // Suppress repeats
      if (held.has(e.code)) return;
      held.add(e.code);

      switch (e.code) {
        case "ArrowLeft":
          tryMoveLeft(s);
          e.preventDefault();
          break;
        case "ArrowRight":
          tryMoveRight(s);
          e.preventDefault();
          break;
        case "ArrowUp":
        case "KeyW":
          tryRotate(s);
          e.preventDefault();
          break;
        case "Space":
          hardDrop(s);
          e.preventDefault();
          break;
        case "ArrowDown":
        case "KeyS":
          softDrop(s, true);
          e.preventDefault();
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameRef]);

  /**
   * Call from useFrame each render tick. Pushes UI updates on throttle or on
   * meaningful events (lock, game over).
   */
  const stepGame = (deltaMs: number) => {
    const s = gameRef.current;
    if (!s) return;

    // Apply gesture rotation (rising edge consumed here)
    const g = gestureRef.current;
    if (!s.isOver) {
      if (g.pinchRisingEdge) {
        tryRotate(s);
        g.pinchRisingEdge = false;
      }
      // Movement only when freeze elapsed and hand visible
      const now = performance.now();
      if (g.handVisible && now > movementFreezeUntilRef.current) {
        tryMoveTo(s, g.targetColumn);
      }

      // Drop interval — gesture-driven fast fall overrides level interval
      const interval = g.dropZoneActive ? 50 : s.dropIntervalMs;
      s.msSinceDrop += deltaMs;
      if (s.msSinceDrop >= interval) {
        tick(s);
        s.msSinceDrop = 0;
      }
    }

    // Throttled UI push
    const now = performance.now();
    const lockChanged = s.lockTick !== lastLockTickRef.current;
    const overChanged = s.isOver !== lastOverRef.current;
    const dueByTime = now - lastUiPushRef.current >= uiThrottleMs;
    if (lockChanged || overChanged || dueByTime) {
      lastUiPushRef.current = now;
      lastLockTickRef.current = s.lockTick;
      lastOverRef.current = s.isOver;
      onUiUpdateRef.current({
        score: s.score,
        lines: s.lines,
        level: s.level,
        queue: s.queue.slice(0, 3),
        isOver: s.isOver,
        current: s.current?.type ?? null,
        lockTick: s.lockTick,
      });
    }
  };

  return { stepGame };
}
