import { Color } from "three";
import type { PieceType } from "../tetris/types";
import { COLORS } from "../tetris/shapes";

export const THEME = {
  bg0: "#0e0a14",
  bg1: "#16101e",
  bg2: "#1f1830",
  ink: "#ece6d8",
  inkDim: "#8a8398",
  accent: "#f5b651",
  accentHot: "#ff7849",
  edge: "#0b0814",
};

export const PIECE_COLORS_HEX: Record<PieceType, string> = COLORS;

export const PIECE_COLORS_THREE: Record<PieceType, Color> = {
  I: new Color(COLORS.I),
  O: new Color(COLORS.O),
  T: new Color(COLORS.T),
  S: new Color(COLORS.S),
  Z: new Color(COLORS.Z),
  J: new Color(COLORS.J),
  L: new Color(COLORS.L),
};

export const COLOR_ACCENT_THREE = new Color(THEME.accent);
export const COLOR_ACCENT_HOT_THREE = new Color(THEME.accentHot);
export const COLOR_EDGE_THREE = new Color(THEME.edge);
