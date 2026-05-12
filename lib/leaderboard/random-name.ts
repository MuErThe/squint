// Random arcade-style names like "PLAYER-7K2X", "BLOCK-X4Q9".
// Always passes validateName: 11–13 chars, charset [A-Z0-9-].

const PREFIXES = [
  "PLAYER",
  "BLOCK",
  "PILOT",
  "GHOST",
  "STACK",
  "TETRA",
  "ZONE",
  "CORE",
  "GRID",
];

const SUFFIX_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 1, 0

function randSuffix(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return out;
}

export function generateRandomName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  // 4-char suffix keeps total length within 16 even for "PLAYER" (6) → 11.
  return `${prefix}-${randSuffix(4)}`;
}
