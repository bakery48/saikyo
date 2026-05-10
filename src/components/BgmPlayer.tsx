'use client';
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY_ON = 'saikyo:bgm:on';
const STORAGE_KEY_VOL = 'saikyo:bgm:vol';

export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(0.4);

  useEffect(() => {
    const savedOn = localStorage.getItem(STORAGE_KEY_ON);
    const savedVol = localStorage.getItem(STORAGE_KEY_VOL);
    if (savedOn === '1') setOn(true);
    if (savedVol) {
      const v = Number(savedVol);
      if (!Number.isNaN(v)) setVol(Math.max(0, Math.min(1, v)));
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = vol;
    if (on) {
      a.play().catch(() => {
        // autoplay may be blocked until first user gesture; the toggle click counts.
      });
    } else {
      a.pause();
    }
    localStorage.setItem(STORAGE_KEY_ON, on ? '1' : '0');
    localStorage.setItem(STORAGE_KEY_VOL, String(vol));
  }, [on, vol]);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => setOn((p) => !p)}
        title={on ? 'BGMをオフ' : 'BGMをオン'}
        style={{
          fontSize: 12,
          padding: '2px 8px',
          border: '1px solid #aaa',
          borderRadius: 4,
          background: on ? '#cfe6ff' : '#f5f5f5',
          cursor: 'pointer',
        }}
      >
        {on ? '♪ BGM ON' : '♪ BGM OFF'}
      </button>
      {on && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={vol}
          onChange={(e) => setVol(Number(e.target.value))}
          title={`音量 ${Math.round(vol * 100)}%`}
          style={{ width: 80 }}
        />
      )}
      <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />
    </span>
  );
}
