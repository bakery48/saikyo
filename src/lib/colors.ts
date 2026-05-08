import type { Color } from '../server/engine/types';

/** Hex codes for the eight seat colors. */
export const COLOR_HEX: Record<Color, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  yellow: '#f1c40f',
  green: '#2ecc71',
  orange: '#e67e22',
  purple: '#9b59b6',
  black: '#2c3e50',
  white: '#ecf0f1',
};

export const COLOR_LABEL: Record<Color, string> = {
  red: '赤',
  blue: '青',
  yellow: '黄',
  green: '緑',
  orange: '橙',
  purple: '紫',
  black: '黒',
  white: '白',
};

/** Fallback color used when a player's `color` field is missing/unknown. */
const FALLBACK_HEX = '#cccccc';

/**
 * Render a player's color piece (a small filled circle).
 * Returns inline-style attributes so the caller can place it where it likes.
 * Defensive: missing/unknown colors fall back to a visible gray fill so the
 * piece is never an invisible empty circle.
 */
export function pieceStyle(
  color: Color | string | undefined | null,
  opts: { size?: number } = {},
): React.CSSProperties {
  const size = opts.size ?? 16;
  const hex = (color && (COLOR_HEX as Record<string, string>)[color]) ?? FALLBACK_HEX;
  return {
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: hex,
    border: color === 'white' ? '2px solid #555' : '2px solid #333',
    boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
    flexShrink: 0,
    verticalAlign: 'middle',
  };
}
