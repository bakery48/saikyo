'use client';
import type { ClientGameState } from '../../shared/messages';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';

export function ActionPhaseView({
  state,
  selfId,
}: {
  state: ClientGameState;
  selfId: string | null;
}) {
  const ap = state.actionPhaseSummary;

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>アクションフェーズ</h2>
      <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
        各プレイヤーがアクションカードを1枚ずつ引いて発動しました。
      </p>

      {!ap || ap.plays.length === 0 ? (
        <p style={{ opacity: 0.7 }}>(該当するアクションなし)</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 8,
          }}
        >
          {ap.plays.map((play) => {
            const p = state.players.find((pp) => pp.id === play.playerId);
            const isSelf = play.playerId === selfId;
            return (
              <li
                key={`${play.playerId}-${play.cardId}`}
                style={{
                  border: `1px solid ${isSelf ? '#0066cc' : '#bbb'}`,
                  borderRadius: 8,
                  padding: 10,
                  background: isSelf ? '#f0f8ff' : '#fff',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p && <span style={pieceStyle(p.color, { size: 14 })} />}
                  <strong style={{ fontSize: 13 }}>
                    {p?.name ?? play.playerId.slice(0, 6)}
                    {isSelf ? ' (you)' : ''}
                  </strong>
                  {p && (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      （{COLOR_LABEL[p.color]}）
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{play.cardName}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{play.effectDesc}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
