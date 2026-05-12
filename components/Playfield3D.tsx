"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import type { Cell, GameState, PieceType } from "@/lib/tetris/types";
import { COLS, ROWS } from "@/lib/tetris/types";
import { getGhostY } from "@/lib/tetris/engine";
import type { GestureState } from "@/lib/hand/types";
import {
  COLOR_ACCENT_THREE,
  PIECE_COLORS_HEX,
  PIECE_COLORS_THREE,
} from "@/lib/render/palette";
import {
  useGameController,
  type UiSnapshot,
} from "@/lib/hooks/useGameController";

interface Playfield3DProps {
  gameRef: React.MutableRefObject<GameState>;
  gestureRef: React.MutableRefObject<GestureState>;
  movementFreezeUntilRef: React.MutableRefObject<number>;
  onUiUpdate: (snap: UiSnapshot) => void;
  /** When true, paused (start screen up). */
  paused: boolean;
}

const CELL = 1;
// Block sits at integer cell coordinates with a small gap.
const BOX = 0.9;

// Playfield centered at (COLS/2 - 0.5, -ROWS/2 + 0.5, 0).
// We render with X going right, Y going up. Row 0 (top) maps to highest Y.
function cellToWorld(col: number, row: number, out: Vector3): Vector3 {
  out.set(col - (COLS - 1) / 2, (ROWS - 1) / 2 - row, 0);
  return out;
}

/** A single tumbling block left behind by a line clear. */
interface CrumbleShard {
  type: PieceType;
  // world position
  x: number;
  y: number;
  z: number;
  // velocity (units per second)
  vx: number;
  vy: number;
  vz: number;
  // rotation (radians)
  rx: number;
  ry: number;
  rz: number;
  // angular velocity (rad/sec)
  arx: number;
  ary: number;
  arz: number;
}

interface FadingEffect {
  shards: CrumbleShard[];
  start: number;
}

const EFFECT_MS = 750;
const CRUMBLE_GRAVITY = 22; // visual units per second^2 (downward)
const FX_CAP = COLS * 4; // up to a 4-line clear at 16 cols = 64 shards

function PlayfieldScene({
  gameRef,
  gestureRef,
  movementFreezeUntilRef,
  onUiUpdate,
  paused,
}: Playfield3DProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const ghostRef = useRef<InstancedMesh>(null);
  const effectsRef = useRef<FadingEffect[]>([]);
  const lastSeenLockTickRef = useRef<number>(0);
  const fxMeshRef = useRef<InstancedMesh>(null);

  const { stepGame } = useGameController({
    gameRef,
    gestureRef,
    movementFreezeUntilRef,
    onUiUpdate,
  });

  // Reusable temp objects (avoid allocs in the frame loop)
  const tmpObj = useMemo(() => new Object3D(), []);
  const tmpVec = useMemo(() => new Vector3(), []);
  const tmpColor = useMemo(() => new Color(), []);
  const tmpMatrix = useMemo(() => new Matrix4(), []);

  // Aim camera at the playfield center on mount and on resize.
  const { camera, size } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame((_, delta) => {
    if (!paused) stepGame(delta * 1000);
    const s = gameRef.current;
    if (!meshRef.current || !ghostRef.current) return;

    // ----- Locked blocks + current piece on the playfield mesh -----
    const mesh = meshRef.current;
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = s.grid[r][c];
        if (!cell) continue;
        cellToWorld(c, r, tmpVec);
        tmpObj.position.copy(tmpVec);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.set(1, 1, 1);
        tmpObj.updateMatrix();
        mesh.setMatrixAt(n, tmpObj.matrix);
        mesh.setColorAt(n, tmpColor.set(PIECE_COLORS_THREE[cell]));
        n += 1;
      }
    }
    // Active piece
    if (s.current) {
      const p = s.current;
      for (let i = 0; i < p.shape.length; i++) {
        for (let j = 0; j < p.shape[i].length; j++) {
          if (!p.shape[i][j]) continue;
          const gr = p.y + i;
          const gc = p.x + j;
          if (gr < 0) continue;
          cellToWorld(gc, gr, tmpVec);
          tmpObj.position.copy(tmpVec);
          tmpObj.rotation.set(0, 0, 0);
          tmpObj.scale.set(1, 1, 1);
          tmpObj.updateMatrix();
          mesh.setMatrixAt(n, tmpObj.matrix);
          mesh.setColorAt(n, tmpColor.set(PIECE_COLORS_THREE[p.type]));
          n += 1;
        }
      }
    }
    // Hide unused instances by setting their scale to 0 via an offscreen matrix.
    const HIDDEN = tmpMatrix.makeScale(0, 0, 0);
    for (let i = n; i < COLS * ROWS; i++) {
      mesh.setMatrixAt(i, HIDDEN);
    }
    mesh.count = COLS * ROWS;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // ----- Ghost piece -----
    const ghost = ghostRef.current;
    let gn = 0;
    if (s.current && !s.isOver) {
      const p = s.current;
      const gy = getGhostY(s);
      for (let i = 0; i < p.shape.length; i++) {
        for (let j = 0; j < p.shape[i].length; j++) {
          if (!p.shape[i][j]) continue;
          const gr = gy + i;
          const gc = p.x + j;
          if (gr < 0) continue;
          // Skip if overlaps with the active piece (no doubled-up rendering)
          if (gy === p.y) continue;
          cellToWorld(gc, gr, tmpVec);
          tmpObj.position.copy(tmpVec);
          tmpObj.rotation.set(0, 0, 0);
          tmpObj.scale.set(1, 1, 1);
          tmpObj.updateMatrix();
          ghost.setMatrixAt(gn, tmpObj.matrix);
          gn += 1;
        }
      }
    }
    for (let i = gn; i < 16; i++) {
      ghost.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
    }
    ghost.count = 16;
    ghost.instanceMatrix.needsUpdate = true;

    // ----- Line-clear "crumble" effect -----
    // When the engine reports new lockTick + clearedRows, spawn one tumbling
    // shard per cleared cell with randomised velocity + spin.
    if (s.lockTick !== lastSeenLockTickRef.current) {
      lastSeenLockTickRef.current = s.lockTick;
      if (s.lastClearedRows.length > 0) {
        const shards: CrumbleShard[] = [];
        for (let k = 0; k < s.lastClearedRows.length; k++) {
          const rowIdx = s.lastClearedRows[k];
          const rowCells = s.lastClearedCells[k] ?? [];
          for (let c = 0; c < COLS; c++) {
            const t = rowCells[c] as Cell;
            if (!t) continue;
            const wx = c - (COLS - 1) / 2;
            const wy = (ROWS - 1) / 2 - rowIdx;
            shards.push({
              type: t,
              x: wx,
              y: wy,
              z: 0,
              // Lateral kick — symmetric outward bias from the row center.
              vx: (wx >= 0 ? 1 : -1) * (1 + Math.random() * 2.5),
              // Pop upward then fall under gravity.
              vy: 1.5 + Math.random() * 2.5,
              // Toward / away from camera for a touch of depth.
              vz: (Math.random() - 0.5) * 3,
              rx: 0,
              ry: 0,
              rz: 0,
              arx: (Math.random() - 0.5) * 7,
              ary: (Math.random() - 0.5) * 7,
              arz: (Math.random() - 0.5) * 7,
            });
          }
        }
        if (shards.length > 0) {
          effectsRef.current.push({ shards, start: performance.now() });
        }
      }
    }

    // Integrate physics + render shards.
    const fx = fxMeshRef.current;
    if (fx) {
      const fxMat = fx.material as MeshStandardMaterial;
      let fxn = 0;
      const now = performance.now();
      const stillAlive: FadingEffect[] = [];
      let aliveOpacity = 0;
      for (const e of effectsRef.current) {
        const ageMs = now - e.start;
        const t = ageMs / EFFECT_MS;
        if (t >= 1) continue;
        // Integrate motion using the frame delta in seconds.
        for (const sh of e.shards) {
          sh.x += sh.vx * delta;
          sh.y += sh.vy * delta;
          sh.z += sh.vz * delta;
          sh.vy -= CRUMBLE_GRAVITY * delta;
          sh.rx += sh.arx * delta;
          sh.ry += sh.ary * delta;
          sh.rz += sh.arz * delta;
        }
        // Shrink + fade. Ease-out for a snappier disintegration.
        const easeOut = 1 - (1 - t) * (1 - t);
        const scale = Math.max(0, 1 - easeOut * 0.55);
        const opacity = 1 - easeOut;
        // Track the most opaque alive effect — the shared material can only
        // hold one alpha value, so we use the loudest. Visually fine because
        // overlapping effects are rare.
        if (opacity > aliveOpacity) aliveOpacity = opacity;
        for (const sh of e.shards) {
          if (fxn >= FX_CAP) break;
          tmpObj.position.set(sh.x, sh.y, sh.z);
          tmpObj.rotation.set(sh.rx, sh.ry, sh.rz);
          tmpObj.scale.set(scale, scale, scale);
          tmpObj.updateMatrix();
          fx.setMatrixAt(fxn, tmpObj.matrix);
          fx.setColorAt(fxn, tmpColor.set(PIECE_COLORS_HEX[sh.type]));
          fxn += 1;
        }
        stillAlive.push(e);
      }
      effectsRef.current = stillAlive;
      fxMat.opacity = stillAlive.length === 0 ? 0 : aliveOpacity;
      for (let i = fxn; i < FX_CAP; i++) {
        fx.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
      }
      fx.count = FX_CAP;
      fx.instanceMatrix.needsUpdate = true;
      if (fx.instanceColor) fx.instanceColor.needsUpdate = true;
    }
  });

  // ----- Static scene elements -----
  // Playfield interior bounds (in world coords)
  const halfW = COLS / 2;
  const halfH = ROWS / 2;
  // Frame thickness
  const T = 0.18;

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[6, 14, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 4, 6]} intensity={0.3} />

      {/* Floor (subtle, receives shadow) */}
      <mesh
        position={[0, -halfH - 0.5, -0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[30, 12]} />
        <meshStandardMaterial color="#0a0712" metalness={0.0} roughness={1} />
      </mesh>

      {/* Back panel — subtle depth */}
      <mesh position={[0, 0, -0.8]}>
        <planeGeometry args={[COLS + 1.2, ROWS + 1.2]} />
        <meshBasicMaterial color="#0c0816" />
      </mesh>

      {/* Subtle 10×20 grid backdrop on the rear plane */}
      <GridBackdrop />

      {/* Frame — left, right, bottom (no top) */}
      <FrameBar
        position={[-halfW - T / 2, 0, 0]}
        size={[T, ROWS + T * 2, T]}
      />
      <FrameBar
        position={[halfW + T / 2, 0, 0]}
        size={[T, ROWS + T * 2, T]}
      />
      <FrameBar
        position={[0, -halfH - T / 2, 0]}
        size={[COLS + T * 2, T, T]}
      />
      {/* Corner posts (top — gives a "machine cabinet" silhouette) */}
      <FrameBar
        position={[-halfW - T / 2, halfH + T / 2, 0]}
        size={[T * 1.6, T * 1.6, T * 1.6]}
      />
      <FrameBar
        position={[halfW + T / 2, halfH + T / 2, 0]}
        size={[T * 1.6, T * 1.6, T * 1.6]}
      />

      {/* Locked-block instanced mesh (200 instances) */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, COLS * ROWS]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[BOX, BOX, BOX]} />
        <meshStandardMaterial
          metalness={0.1}
          roughness={0.4}
          vertexColors={false}
        />
      </instancedMesh>

      {/* Ghost piece — wireframe basic material */}
      <instancedMesh
        ref={ghostRef}
        args={[undefined, undefined, 16]}
        frustumCulled={false}
      >
        <boxGeometry args={[BOX, BOX, BOX]} />
        <meshBasicMaterial
          color="#ece6d8"
          wireframe
          transparent
          opacity={0.28}
        />
      </instancedMesh>

      {/* Line-clear crumble FX */}
      <instancedMesh
        ref={fxMeshRef}
        args={[undefined, undefined, FX_CAP]}
        frustumCulled={false}
      >
        <boxGeometry args={[BOX * 0.85, BOX * 0.85, BOX * 0.85]} />
        <meshStandardMaterial
          transparent
          opacity={0}
          emissive={"#f5b651"}
          emissiveIntensity={0.55}
          metalness={0.0}
          roughness={0.55}
        />
      </instancedMesh>
    </>
  );
}

function FrameBar({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_ACCENT_THREE,
      }),
    [],
  );
  return (
    <mesh position={position} material={material}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function GridBackdrop() {
  // Build vertical + horizontal lines as a single thin mesh group.
  // Lines sit just slightly in front of the back panel so they're visible
  // but don't z-fight with blocks at z=0.
  const halfW = COLS / 2;
  const halfH = ROWS / 2;
  const lineMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_ACCENT_THREE,
        transparent: true,
        opacity: 0.08,
      }),
    [],
  );
  const verticals = [];
  for (let c = 1; c < COLS; c++) {
    const x = c - halfW;
    verticals.push(
      <mesh key={`v${c}`} position={[x, 0, -0.55]} material={lineMat}>
        <boxGeometry args={[0.015, ROWS, 0.01]} />
      </mesh>,
    );
  }
  const horizontals = [];
  for (let r = 1; r < ROWS; r++) {
    const y = halfH - r;
    horizontals.push(
      <mesh key={`h${r}`} position={[0, y, -0.55]} material={lineMat}>
        <boxGeometry args={[COLS, 0.015, 0.01]} />
      </mesh>,
    );
  }
  return (
    <>
      {verticals}
      {horizontals}
    </>
  );
}

export function Playfield3D(props: Playfield3DProps) {
  return (
    <Canvas
      shadows
      // Pulled back further so blocks read compact and the field has breathing
      // room on all sides. ~5° elevation for a subtle 3D feel.
      camera={{ position: [0, 4, 46], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <PlayfieldScene {...props} />
    </Canvas>
  );
}

// Note: BOX exported for next-piece preview reuse — keep symmetric.
export { CELL, BOX };
