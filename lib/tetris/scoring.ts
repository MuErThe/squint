export const LINE_SCORE = [0, 100, 300, 500, 800]; // index = lines cleared

export function levelDropMs(level: number): number {
  return Math.max(120, 800 - (level - 1) * 70);
}

export function levelFromLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}
