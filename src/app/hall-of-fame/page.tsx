'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { StoredChampion } from '../../server/db';

export default function HallOfFamePage() {
  const [champions, setChampions] = useState<StoredChampion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/hall-of-fame')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { champions: StoredChampion[] }) => {
        if (!cancelled) setChampions(data.champions);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(String(e.message));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          borderBottom: '1px solid #ddd',
          paddingBottom: 8,
        }}
      >
        <h1 style={{ margin: 0 }}>🏆 殿堂入りモンスター</h1>
        <Link href="/">← ロビーへ</Link>
      </header>

      {error && <div style={{ background: '#fee', padding: 8, borderRadius: 6 }}>Error: {error}</div>}
      {champions === null && !error && <p>読み込み中...</p>}
      {champions && champions.length === 0 && (
        <p style={{ opacity: 0.7 }}>まだ殿堂入りしたモンスターはいません。</p>
      )}
      {champions && champions.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
          {champions.map((c) => (
            <li
              key={c.id}
              style={{
                background: 'linear-gradient(135deg, #fff3e0, #fef6ff)',
                border: '2px solid #d4a000',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>
                  {c.ownerName} — {c.monsterName}
                </h3>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: '6px 0' }}>
                HP{c.monster.stats.hp} ATK{c.monster.stats.atk} DEF{c.monster.stats.def}{' '}
                SPD{c.monster.stats.spd}
              </p>
              <details>
                <summary>
                  アクティブスキル ({c.monster.actives.length}) ／ パッシブ ({c.monster.passives.length})
                </summary>
                <ul style={{ marginTop: 4, fontSize: 13 }}>
                  {c.monster.actives.map((a) => (
                    <li key={a.id}>
                      {a.order}. {a.name} {a.rarity ? `[${a.rarity}]` : ''}
                    </li>
                  ))}
                  {c.monster.passives.map((p) => (
                    <li key={p.id} style={{ fontStyle: 'italic' }}>
                      passive: {p.name}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
