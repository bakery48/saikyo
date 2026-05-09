'use client';
import { useState, type ReactNode } from 'react';

/**
 * Skill name with an instant custom tooltip on hover. Uses a dotted underline
 * + cursor:help to signal interactivity. Children render inline next to the
 * name (e.g. rarity badge).
 */
export function SkillNameHover({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip: string;
  children?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: 'help',
      }}
    >
      <span
        style={{
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: 2,
        }}
      >
        {label}
      </span>
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            background: '#222',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: 'pre-line',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            minWidth: 140,
            fontWeight: 400,
          }}
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
