"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { PieceType } from "@/lib/tetris/types";
import { SHAPES } from "@/lib/tetris/shapes";
import { PIECE_COLORS_HEX } from "@/lib/render/palette";

interface NextPiecePreviewProps {
  piece: PieceType;
  size: number;
  prominent?: boolean;
}

export function NextPiecePreview({
  piece,
  size,
  prominent = false,
}: NextPiecePreviewProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.15))",
      }}
      className="rounded-sm border"
    >
      <Canvas
        camera={{ position: [3.5, 3, 5], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 6]} intensity={1.1} />
        <directionalLight position={[-3, 1, 3]} intensity={0.25} />
        <PieceGroup piece={piece} prominent={prominent} />
      </Canvas>
    </div>
  );
}

function PieceGroup({
  piece,
  prominent,
}: {
  piece: PieceType;
  prominent: boolean;
}) {
  const ref = useRef<Group>(null);
  const shape = useMemo(() => SHAPES[piece], [piece]);
  const color = PIECE_COLORS_HEX[piece];

  // Compute filled-cell bounds for centering
  const { offX, offY, scale } = useMemo(() => {
    let minI = shape.length;
    let maxI = -1;
    let minJ = shape[0].length;
    let maxJ = -1;
    for (let i = 0; i < shape.length; i++)
      for (let j = 0; j < shape[i].length; j++)
        if (shape[i][j]) {
          if (i < minI) minI = i;
          if (i > maxI) maxI = i;
          if (j < minJ) minJ = j;
          if (j > maxJ) maxJ = j;
        }
    const w = maxJ - minJ + 1;
    const h = maxI - minI + 1;
    return {
      offX: -((minJ + maxJ) / 2),
      offY: (minI + maxI) / 2,
      scale: prominent ? Math.min(2.6 / Math.max(w, h), 1) * 1.6 : Math.min(2.6 / Math.max(w, h), 1) * 1.35,
    };
  }, [shape, prominent]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * (10 * Math.PI) / 180;
  });

  const blocks: { x: number; y: number }[] = [];
  for (let i = 0; i < shape.length; i++)
    for (let j = 0; j < shape[i].length; j++)
      if (shape[i][j]) blocks.push({ x: j + offX, y: -(i) + offY });

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      {blocks.map((b, idx) => (
        <mesh key={idx} position={[b.x, b.y, 0]}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial
            color={color}
            metalness={0.1}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
