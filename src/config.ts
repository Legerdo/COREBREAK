// Screen layout (logical pixels). The canvas is rendered at 640x360 and upscaled by an integer zoom.
export const W = 640;
export const H = 360;

export const TILE = 16;
export const COLS = 31;
export const ROWS = 12;

export const FIELD_X = 72;
export const FIELD_Y = 24;
export const FIELD_W = COLS * TILE; // 496
export const FIELD_H = ROWS * TILE; // 192
export const FIELD_BOTTOM = FIELD_Y + FIELD_H; // 216

// Launch / intake point of the machine in FIELD-LOCAL pixel coordinates.
export const NOZZLE_LOCAL = { x: FIELD_W / 2, y: FIELD_H + 8 };
// Same point in screen coordinates.
export const NOZZLE = { x: FIELD_X + NOZZLE_LOCAL.x, y: FIELD_Y + NOZZLE_LOCAL.y };

export const FONT = 'Galmuri11';
export const FONT_BOLD = 'Galmuri11';
export const FONT_SMALL = 'Galmuri9';
export const FONT_TINY = 'Galmuri7';
