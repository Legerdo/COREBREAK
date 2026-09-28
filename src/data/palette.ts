// Endesga 32 based palette. Every sprite in the game is built from these colors.
export const P = {
  rust: 0xbe4a2f,
  clay: 0xd77643,
  sand: 0xead4aa,
  tan: 0xe4a672,
  brown: 0xb86f50,
  darkBrown: 0x733e39,
  plum: 0x3e2731,
  crimson: 0xa22633,
  red: 0xe43b44,
  orange: 0xf77622,
  amber: 0xfeae34,
  yellow: 0xfee761,
  green: 0x63c74d,
  forest: 0x3e8948,
  pine: 0x265c42,
  deepTeal: 0x193c3e,
  blue: 0x124e89,
  sky: 0x0099db,
  cyan: 0x2ce8f5,
  white: 0xffffff,
  silver: 0xc0cbdc,
  steel: 0x8b9bb4,
  slate: 0x5a6988,
  navy: 0x3a4466,
  ink: 0x262b44,
  black: 0x181425,
  hotpink: 0xff0044,
  purple: 0x68386c,
  magenta: 0xb55088,
  pink: 0xf6757a,
  peach: 0xe8b796,
  rose: 0xc28569,
} as const;

export type PaletteKey = keyof typeof P;

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
