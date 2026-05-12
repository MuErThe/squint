export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Cell = PieceType | null;
export type Grid = Cell[][]; // [row][col], row 0 is top

export interface Piece {
  type: PieceType;
  shape: number[][]; // square matrix, 1 = filled
  x: number; // column of top-left of bounding box
  y: number; // row of top-left (can be negative on spawn)
}

export interface GameState {
  grid: Grid;
  current: Piece | null;
  queue: PieceType[]; // upcoming pieces, length always >= 3
  score: number;
  lines: number;
  level: number;
  dropIntervalMs: number;
  msSinceDrop: number;
  isOver: boolean;
  /** Rows cleared on the most recent lock — UI animation reads this. */
  lastClearedRows: number[];
  /** Cell contents (per row) at the moment of the most recent clear — for animations. */
  lastClearedCells: Cell[][];
  /** Monotonic counter incremented each time a piece locks. UI uses for effect keys. */
  lockTick: number;
}

export const COLS = 10;
export const ROWS = 20;
