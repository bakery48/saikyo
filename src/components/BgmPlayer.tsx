'use client';
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY_ON = 'saikyo:bgm:on';
const STORAGE_KEY_VOL = 'saikyo:bgm:vol';
export const STORAGE_KEY_SE_VOL = 'saikyo:se:vol';
const DEFAULT_SE_VOL = 0.6;

export function getSeVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_SE_VOL;
  const v = Number(localStorage.getItem(STORAGE_KEY_SE_VOL));
  return Number.isNaN(v) || v === 0 && !localStorage.getItem(STORAGE_KEY_SE_VOL) ? DEFAULT_SE_VOL : Math.max(0, Math.min(1, v));
}

export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(0.4);
  const [seVol, setSeVol] = useState(DEFAULT_SE_VOL);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const savedOn = localStorage.getItem(STORAGE_KEY_ON);
    const savedVol = localStorage.getItem(STORAGE_KEY_VOL);
    const savedSe = localStorage.getItem(STORAGE_KEY_SE_VOL);
    if (savedOn === '1') setOn(true);
    if (savedVol) {
      const v = Number(savedVol);
      if (!Number.isNaN(v)) setVol(Math.max(0, Math.min(1, v)));
    }
    if (savedSe) {
      const v = Number(savedSe);
      if (!Number.isNaN(v)) setSeVol(Math.max(0, Math.min(1, v)));
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = vol;
    if (on) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
    localStorage.setItem(STORAGE_KEY_ON, on ? '1' : '0');
    localStorage.setItem(STORAGE_KEY_VOL, String(vol));
  }, [on, vol]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SE_VOL, String(seVol));
  }, [seVol]);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        title="音量設定"
        style={{
          fontSize: 12,
          padding: '2px 8px',
          border: '1px solid #aaa',
          borderRadius: 4,
          background: on ? '#cfe6ff' : '#f5f5f5',
          cursor: 'pointer',
        }}
      >
        🔊 音量
      </button>
      {expanded && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'grid',
            gap: 8,
            zIndex: 100,
            minWidth: 200,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <button
              type="button"
              onClick={() => setOn((p) => !p)}
              style={{
                fontSize: 11,
                padding: '2px 6px',
                border: '1px solid #aaa',
                borderRadius: 4,
                background: on ? '#cfe6ff' : '#f5f5f5',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {on ? '♪ BGM ON' : '♪ BGM OFF'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={vol}
              onChange={(e) => setVol(Number(e.target.value))}
              title={`BGM音量 ${Math.round(vol * 100)}%`}
              style={{ flex: 1 }}
              disabled={!on}
            />
            <span style={{ fontSize: 11, opacity: 0.7, width: 30, textAlign: 'right' }}>{Math.round(vol * 100)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ fontSize: 11, whiteSpace: 'nowrap', width: 60 }}>SE音量</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={seVol}
              onChange={(e) => setSeVol(Number(e.target.value))}
              title={`SE音量 ${Math.round(seVol * 100)}%`}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, opacity: 0.7, width: 30, textAlign: 'right' }}>{Math.round(seVol * 100)}%</span>
          </div>
        </div>
      )}
      <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />
    </span>
  );
}
