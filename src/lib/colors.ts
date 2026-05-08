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

/**
 * Render a player's color piece (a small filled circle).
 * Returns inline-style attributes so the caller can place it where it likes.
 */
export function pieceStyle(
  color: Color,
  opts: { size?: number } = {},
): React.CSSProperties {
  const size = opts.size ?? 16;
  return {
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: COLOR_HEX[color],
    border: color === 'white' ? '1px solid #888' : '1px solid #444',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
    flexShrink: 0,
  };
}
