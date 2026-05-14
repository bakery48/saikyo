'use client';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Trigger button
// ---------------------------------------------------------------------------

export function RulesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          padding: '2px 8px',
          cursor: 'pointer',
          border: '1px solid #bbb',
          borderRadius: 4,
          background: '#f5f5f5',
        }}
      >
        ？ ルール
      </button>
      {open && <RulesModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '32px 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: '24px 28px',
          maxWidth: 720,
          width: '100%',
          fontSize: 13,
          lineHeight: 1.7,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            fontSize: 18,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>ゲームルール</h2>

        <Section title="ゲームの流れ">
          <p style={{ margin: '4px 0' }}>
            2〜8人対応。CPUで合計8席を補完。モンスターを1体選び、ラウンドを繰り返してスキルを強化。最終トーナメントで優勝を目指す。
          </p>
          <ol style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>モンスター選択</li>
            <li>ラウンド × N（デフォルト3）
              <ul style={{ margin: '2px 0', paddingLeft: 18 }}>
                <li>ミニラウンド × M（デフォルト3）
                  <ul style={{ margin: '2px 0', paddingLeft: 18 }}>
                    <li>イベント → アクション → ドラフト</li>
                  </ul>
                </li>
                <li>バトル → 鍛え直し（最終ラウンド以外）</li>
              </ul>
            </li>
            <li>トーナメント（シングルイリミネーション）</li>
          </ol>
        </Section>

        <Section title="モンスター選択">
          <p style={{ margin: '4px 0' }}>
            8体が公開され、全員が同時に1体を選ぶ。被った場合は再選択（最大8回）。収束しなければランダム分配。
          </p>
        </Section>

        <Section title="イベントフェーズ">
          <p style={{ margin: '4px 0' }}>
            イベントデッキから1枚引き、対象プレイヤーに効果を適用。対象は <em>全員 / ランダム1人 / HP最低 / ATK最高</em> のいずれか。
          </p>
          <Table
            headers={['効果', '内容']}
            rows={[
              ['ステータス変化', '永続的にステータスが増減'],
              ['HP回復', 'HPを回復（最低1まで減少）'],
              ['スキル追加', 'スキル山札の先頭を1枚獲得'],
              ['スキル順逆転', '次のバトルでスロット順が逆になる'],
              ['追加バトル', '即座にバトルを実施してアクションへ戻る'],
            ]}
          />
        </Section>

        <Section title="アクションフェーズ">
          <p style={{ margin: '4px 0' }}>
            全員が個人の手札を持つ（ゲーム開始時に3枚配布、各フェーズ開始時に1枚ドロー）。
            手札から1枚選んで使用し、墓地へ。山札が枯渇したら墓地をシャッフルして再利用。
          </p>
          <Table
            headers={['効果', '内容']}
            rows={[
              ['ステータス変化', '永続的にステータスが増減'],
              ['スキル山札ドロー', 'スキル山札の先頭を1枚獲得'],
              ['スキル墓地回収', 'スキル墓地からランダムに1枚獲得'],
              ['アクティブ破棄', '自分のスロットをランダムに1つ廃棄'],
              ['スロット入れ替え', '誰かのスロット2つの順序を入れ替え'],
            ]}
          />
        </Section>

        <Section title="ドラフトフェーズ">
          <p style={{ margin: '4px 0' }}>
            スキル山札から最大8枚公開。全員が同時に1枚を選ぶ（被り解消はモンスター選択と同じ仕組み、最大4回）。
            残ったカードは墓地へ。
          </p>
        </Section>

        <Section title="バトルフェーズ">
          <p style={{ margin: '4px 0' }}>
            全プレイヤーをランダムにペアリング。奇数の場合は1人が不戦勝（bye）。
          </p>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13 }}>先攻・後攻</h4>
          <p style={{ margin: '4px 0' }}>
            d6 + SPD をロール。高い方が先攻（同値は再ロール）。
          </p>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13 }}>バトルループ</h4>
          <p style={{ margin: '4px 0' }}>
            先攻・後攻が交互にスロットを1つずつ使用。両者のスロットがなくなったら終了。
          </p>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13 }}>攻撃ダメージ計算</h4>
          <p style={{ margin: '4px 0', fontFamily: 'monospace', background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>
            ダメージ = max(1, floor(使用Stat × 倍率 × 次撃増幅 − 相手DEF))
          </p>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13 }}>SPD回避</h4>
          <p style={{ margin: '4px 0' }}>
            防御側のSPDが攻撃側を上回るとMISS確率が発生（差1→10%、差10以上→50%）。
          </p>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13 }}>勝利判定（スロット消費後）</h4>
          <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
            <li>片方HP≤0 → HP高い方の勝ち</li>
            <li>両方HP≤0 → HP高い方の勝ち</li>
            <li>{'両方HP>0 → HP高い方の勝ち'}</li>
            <li>HP同値 → SPD高い方の勝ち</li>
            <li>全て同値 → 引き分け</li>
          </ol>
        </Section>

        <Section title="鍛え直しフェーズ">
          <p style={{ margin: '4px 0' }}>
            バトルで<strong>負けた</strong>プレイヤーのみ対象。勝者・bye・引き分けは対象外。以下から1つ選ぶ：
          </p>
          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
            <li>ステータスUP：HP / ATK / DEF / SPD のいずれか +2</li>
            <li>スキル獲得：スキル山札の先頭を1枚獲得</li>
          </ul>
        </Section>

        <Section title="トーナメント">
          <p style={{ margin: '4px 0' }}>
            シングルイリミネーション。プレイヤー数を2の冪に切り上げてbyeで補完。
            引き分けは最大4回再戦（必ず勝者を決定）。
          </p>
        </Section>

        <Section title="スキルの種類">
          <h4 style={{ margin: '8px 0 4px', fontSize: 13 }}>アクティブスキル（スロット）</h4>
          <p style={{ margin: '4px 0' }}>
            バトル中に順番に使用される。スロット番号（1〜）の順で発動。
          </p>
          <Table
            headers={['効果', '内容']}
            rows={[
              ['ATK/DEF/SPD×倍率 攻撃', '使用ステータス × 倍率 − 相手DEF のダメージ'],
              ['DEF無視ダメージ', '固定ダメージ（DEF・シールド無視）'],
              ['HP回復', '自分のHPを回復'],
              ['シールド', '次の被ダメージを軽減（1回限り）'],
              ['バフ/デバフ', 'ステータスを一時的に変化（once=次の1回 / battle=バトル中）'],
              ['次撃増幅', '次の自分の攻撃のダメージ倍率を設定'],
              ['無効化', '相手の次のスロットを無効にする'],
              ['ターンスキップ', '相手の次のターンをスキップ'],
              ['スロット順シャッフル', '相手の残りスロット順をランダムに並び替え'],
              ['多段攻撃', '次の攻撃をN回行う（攻撃以外なら不発・自分にペナルティ）'],
              ['スロット巻き戻し', 'スロットをN つ戻す（このカードは廃棄）'],
              ['デジャヴ・アタック', '使用回数に応じてATKが増える攻撃'],
            ]}
          />
          <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>パッシブスキル</h4>
          <p style={{ margin: '4px 0' }}>
            条件を満たすと自動発動。バトル中に効果が続く。
          </p>
          <Table
            headers={['トリガー', 'タイミング']}
            rows={[
              ['バトル開始時', 'バトル開始直後に1回発動'],
              ['初撃時', '最初のスロット使用時に発動'],
              ['スロット使用直前', '自分のターン開始時に毎回発動'],
              ['スロット発動後', '自分のスロットを使うたびに発動'],
              ['被ダメ時', 'ダメージを受けるたびに発動'],
              ['与ダメ時', 'ダメージを与えるたびに発動'],
            ]}
          />
          <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>レアリティ</h4>
          <Table
            headers={['レアリティ', '枚数']}
            rows={[
              ['N（ノーマル）', '多数'],
              ['R（レア）', '20枚程度'],
              ['SR（スーパーレア）', '12枚程度'],
              ['SSR（スーパースーパーレア）', '4枚程度'],
            ]}
          />
        </Section>

        <Section title="モンスター一覧">
          <Table
            headers={['名前', 'HP', 'ATK', 'DEF', 'SPD', 'パッシブ（固有）']}
            rows={[
              ['デーモン', '18', '6', '6', '2', '悪の目醒め：初撃ダメージ×2'],
              ['ユニコーン', '16', '4', '5', '4', '清廉潔白：自分ターン開始時HP+1'],
              ['ゴーレム', '20', '5', '7', '2', '岩鎧：被ダメ−1'],
              ['フェンリル', '10', '5', '3', '8', '疾風の祝福：先攻ロール+2'],
              ['フェアリー', '10', '5', '3', '6', '軽やかな舞踊：回避率+15%'],
              ['ワイバーン', '8', '6', '3', '7', '急襲の本能：初撃がDEF無視'],
              ['スライム', '14', '5', '5', '5', '形なき適応：ATK/DEFの高い方+2'],
              ['ウロボロス', '10', '3', '4', '6', '時の輪廻：攻撃ごとにATK+1'],
              ['ヴァンパイア', '8', '6', '3', '5', '吸血：与ダメの1/2を回復'],
              ['フェニックス', '12', '5', '4', '5', '不死鳥の加護：1度だけ最大HP1/4で耐える'],
              ['バーサーカー', '8', '7', '2', '5', '怒りの咆哮：被ダメ時ATK+1累積'],
              ['ウィザード', '12', '3', '5', '5', '装甲呪詛：与ダメ時相手DEF-1累積'],
              ['ケルベロス', '12', '5', '4', '5', '連携攻撃：攻撃時10%で2回発動'],
              ['カーバンクル', '14', '4', '5', '4', '宝玉の反射：被ダメ1/3を相手に反射'],
              ['ナイト', '14', '5', '5', '3', '背水の覚悟：HP半分以下でATK+4'],
              ['スカラベ', '14', '4', '5', '4', '聖甲虫の加護：1度だけ被ダメ完全無効'],
              ['プリズム', '9', '5', '2', '6', 'プリズムシールド：4〜9のダメージを無効化'],
              ['ゴブリン', '12', '4', '3', '6', 'チクチク攻撃：2以下のダメージ時に追加3真ダメ'],
              ['バグ ※隠し', '10', '5', '5', '5', '崩壊する身体：スロット発動後HP-3/ATK/DEF/SPD-2'],
            ]}
          />
        </Section>

        <Section title="命名システム">
          <p style={{ margin: '4px 0' }}>
            獲得したスキルカードのタグ（短い名詞）を「・」でつないでモンスター名を作れる。
            使えるタグの種類と枚数は獲得済みスキルのマルチセットに一致。最大60文字、最低1パーツ。
          </p>
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open style={{ marginBottom: 12 }}>
      <summary
        style={{
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          padding: '4px 0',
          borderBottom: '1px solid #e0e0e0',
          marginBottom: 6,
          userSelect: 'none',
        }}
      >
        {title}
      </summary>
      {children}
    </details>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        margin: '6px 0',
      }}
    >
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                textAlign: 'left',
                padding: '3px 6px',
                background: '#f0f0f0',
                borderBottom: '1px solid #ccc',
                whiteSpace: 'nowrap',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            {row.map((cell, j) => (
              <td
                key={j}
                style={{
                  padding: '3px 6px',
                  borderBottom: '1px solid #eee',
                  verticalAlign: 'top',
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
