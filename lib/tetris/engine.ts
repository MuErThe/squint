import { SevenBag } from "./bag";
import { LINE_SCORE, levelDropMs, levelFromLines } from "./scoring";
import { COLORS, SHAPES } from "./shapes";
import {
  COLS,
  ROWS,
  type Cell,
  type GameState,
  type Grid,
  type Piece,
  type PieceType,
} from "./types";

// A single shared bag per state — stored on the state via closure-like attach.
// We expose `getBag` so callers (tests) can swap. For runtime we just keep a
// reference via WeakMap so the engine functions remain pure.
const bagMap = new WeakMap<GameState, SevenBag>();

function getBag(state: GameState): SevenBag {
  let bag = bagMap.get(state);
  if (!bag) {
    bag = new SevenBag();
    bagMap.set(state, bag);
  }
  return bag;
}

export function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array<Cell>(COLS).fill(null),
  );
}

export function cloneShape(shape: number[][]): number[][] {
  return shape.map((row) => [...row]);
}

export function rotateMatrix(m: number[][]): number[][] {
  const n = m.length;
  const out: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[j][n - 1 - i] = m[i][j];
    }
  }
  return out;
}

export function isValid(
  grid: Grid,
  shape: number[][],
  x: number,
  y: number,
): boolean {
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (!shape[i][j]) continue;
      const gx = x + j;
      const gy = y + i;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
      if (gy < 0) continue; // above top is allowed for spawn
      if (grid[gy][gx] !== null) return false;
    }
  }
  return true;
}

function spawnPiece(type: PieceType): Piece {
  const shape = cloneShape(SHAPES[type]);
  // Center the piece horizontally over the playfield.
  const w = shape[0].length;
  const x = Math.floor((COLS - w) / 2);
  // Spawn just above the visible top: y = 0 for the bounding box, but most
  // pieces have empty top rows so the visible cells start around row 1.
  return { type, shape, x, y: 0 };
}

function refillQueue(state: GameState): void {
  const bag = getBag(state);
  while (state.queue.length < 4) state.queue.push(bag.next());
}

export function createInitialState(): GameState {
  const state: GameState = {
    grid: emptyGrid(),
    current: null,
    queue: [],
    score: 0,
    lines: 0,
    level: 1,
    dropIntervalMs: levelDropMs(1),
    msSinceDrop: 0,
    isOver: false,
    lastClearedRows: [],
    lastClearedCells: [],
    lockTick: 0,
  };
  refillQueue(state);
  // Spawn first piece
  spawnNext(state);
  return state;
}

function spawnNext(state: GameState): void {
  refillQueue(state);
  const type = state.queue.shift()!;
  refillQueue(state);
  const piece = spawnPiece(type);
  if (!isValid(state.grid, piece.shape, piece.x, piece.y)) {
    state.current = piece; // show it but mark over
    state.isOver = true;
    return;
  }
  state.current = piece;
  state.msSinceDrop = 0;
}

function lockPiece(state: GameState): void {
  if (!state.current) return;
  const p = state.current;
  for (let i = 0; i < p.shape.length; i++) {
    for (let j = 0; j < p.shape[i].length; j++) {
      if (!p.shape[i][j]) continue;
      const gx = p.x + j;
      const gy = p.y + i;
      if (gy < 0) {
        // Locking above the top means game over.
        state.isOver = true;
        continue;
      }
      state.grid[gy][gx] = p.type;
    }
  }

  // Clear full lines
  const cleared: number[] = [];
  const clearedCells: Cell[][] = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.grid[r].every((c) => c !== null)) {
      cleared.push(r);
      clearedCells.push([...state.grid[r]]);
    }
  }
  if (cleared.length > 0) {
    const remaining = state.grid.filter((_, idx) => !cleared.includes(idx));
    while (remaining.length < ROWS) {
      remaining.unshift(Array<Cell>(COLS).fill(null));
    }
    state.grid = remaining;
    state.lines += cleared.length;
    state.score += LINE_SCORE[cleared.length] * state.level;
    state.level = levelFromLines(state.lines);
    state.dropIntervalMs = levelDropMs(state.level);
  }
  state.lastClearedRows = cleared;
  state.lastClearedCells = clearedCells;
  state.lockTick += 1;
  state.current = null;
  state.msSinceDrop = 0;
  if (!state.isOver) spawnNext(state);
  // Reference COLORS to silence unused warnings in production tree-shake when
  // the engine is imported standalone — small hint that this is the canonical
  // color source.
  void COLORS;
}

const KICKS = [0, -1, 1, -2, 2];

export function tryRotate(state: GameState): void {
  if (!state.current || state.isOver) return;
  const p = state.current;
  if (p.type === "O") return; // O never rotates
  const rotated = rotateMatrix(p.shape);
  for (const dx of KICKS) {
    if (isValid(state.grid, rotated, p.x + dx, p.y)) {
      p.shape = rotated;
      p.x += dx;
      return;
    }
  }
}

function pieceCenterCol(shape: number[][]): number {
  let minJ = shape[0].length;
  let maxJ = -1;
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j]) {
        if (j < minJ) minJ = j;
        if (j > maxJ) maxJ = j;
      }
    }
  }
  return Math.round((minJ + maxJ) / 2);
}

function pieceBounds(shape: number[][]): { minJ: number; maxJ: number } {
  let minJ = shape[0].length;
  let maxJ = -1;
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j]) {
        if (j < minJ) minJ = j;
        if (j > maxJ) maxJ = j;
      }
    }
  }
  return { minJ, maxJ };
}

export function tryMoveTo(state: GameState, targetCol: number): void {
  if (!state.current || state.isOver) return;
  const p = state.current;
  const center = pieceCenterCol(p.shape);
  const { minJ, maxJ } = pieceBounds(p.shape);
  let desiredX = targetCol - center;
  // Clamp so piece stays in bounds (account for filled-cell extents).
  const minX = -minJ;
  const maxX = COLS - 1 - maxJ;
  desiredX = Math.max(minX, Math.min(maxX, desiredX));

  while (p.x !== desiredX) {
    const step = p.x < desiredX ? 1 : -1;
    if (isValid(state.grid, p.shape, p.x + step, p.y)) {
      p.x += step;
    } else {
      break;
    }
  }
}

export function tryMoveLeft(state: GameState): void {
  if (!state.current || state.isOver) return;
  const p = state.current;
  if (isValid(state.grid, p.shape, p.x - 1, p.y)) p.x -= 1;
}

export function tryMoveRight(state: GameState): void {
  if (!state.current || state.isOver) return;
  const p = state.current;
  if (isValid(state.grid, p.shape, p.x + 1, p.y)) p.x += 1;
}

/**
 * Soft-drop one row. If blocked, locks the piece. With `scoreBonus`, awards 1
 * point per successful manual drop (per spec).
 */
export function softDrop(state: GameState, scoreBonus = true): void {
  if (!state.current || state.isOver) return;
  const p = state.current;
  if (isValid(state.grid, p.shape, p.x, p.y + 1)) {
    p.y += 1;
    if (scoreBonus) state.score += 1;
  } else {
    lockPiece(state);
  }
}

export function hardDrop(state: GameState): void {
  if (!state.current || state.isOver) return;
  const p = state.current;
  let dropped = 0;
  while (isValid(state.grid, p.shape, p.x, p.y + 1)) {
    p.y += 1;
    dropped += 1;
  }
  state.score += 2 * dropped;
  lockPiece(state);
}

export function tick(state: GameState, _deltaMs: number): void {
  if (state.isOver) return;
  // Called once per drop tick. Gravity drop (no score bonus).
  softDrop(state, false);
}

export function getGhostY(state: GameState): number {
  if (!state.current) return 0;
  const p = state.current;
  let y = p.y;
  while (isValid(state.grid, p.shape, p.x, y + 1)) y += 1;
  return y;
}
