# Saikyo — 開発リファレンス

## プロジェクト概要

2〜8人対応の日本語モンスターカードゲーム。Next.js (App Router) + TypeScript + WebSocket (ws ライブラリ)。
プレイヤーはモンスターをドラフトし、スキルを獲得しながら最終トーナメントで優勝を目指す。

---

## ゲームルール

### プレイヤー数

- 2〜8人（人間）+ CPUで合計8席に自動補完
- 色：red / blue / yellow / green / orange / purple / black / white（シード決定論的）

---

### ゲーム全体の流れ

```
モンスター選択 (pick_monster)
  ↓
ラウンド 1〜3
  └── ミニラウンド 1〜3
        └── イベント → アクション → ドラフト
              ↓ (ミニラウンド3完了)
            バトル → 報酬
  ↓ (ラウンド3完了)
トーナメント (tournament)
  ↓
終了 (finished)
```

---

## フェーズ詳細

### 1. モンスター選択 (pick_monster)

- 8体のモンスターが全員に公開される
- 全員が同時に1体を選択（ドラフト形式）
- **被り解消ルール：**
  - 唯一選んだプレイヤー → そのモンスター獲得
  - 複数が同じモンスターを選択 → 全員が再選択
  - 被ったカードはプールから除外（setAside）され再選不可
  - 最大8回試行；枯渇したらフォールバック分配（ランダム）
- 全員確定後 `state.monsterPick = null`、`phase = 'event'`、`miniRound = 1`

### 2. イベントフェーズ (event)

- イベントデッキ先頭から1枚引く（枯渇時は墓地をシャッフルして再利用）
- **ターゲット：**
  - `all` — 生存全員
  - `random` — ランダム1人
  - `lowestHp` — HPが最低のプレイヤー
  - `highestAtk` — ATKが最高のプレイヤー
- **効果：**
  - `stat_mod` — ステータス永続変化
  - `heal` — HP回復
  - `damage` — HP減少（最低1）
  - `swap_stat` — 他ランダムプレイヤーとそのステータスを交換
  - `add_skill_top` — スキルデッキ先頭を引いてモンスターに追加
- 完了後 `phase = 'action'`、`state.eventPhaseSummary` に結果格納

### 3. アクションフェーズ (action)

- **手札制：** 各プレイヤーは個人の手札（`Player.actionHand`）を持つ
  - **ゲーム開始時**（`createInitialState` の時点 = モンスター選択前）に共通山札から **4枚** ドロー
  - 各アクションフェーズ開始時に **1枚** ドロー → 手札から1枚選んで使用 → 墓地へ
  - つまり手札サイズは 4↔5 を行き来する
- 山札が枯渇したら墓地をシャッフルして再利用（共通プール）
- 手札の中身はオーナーのみ表示（`ClientGameState.myActionHand` に自分の分だけ入る）
- 全員が選択を提出するまで待機（`state.actionPhase = { pendingPlayerIds, submittedPlays }`）
- **効果：**
  - `stat_mod` (duration: `permanent`) — ステータス永続変化
  - `stat_mod` (duration: `next_battle`) — 次バトルのみ適用されるバフ（消費後削除）
  - `draw_skill_top` — スキルデッキ先頭を追加
  - `recover_skill_from_grave` — スキル墓地からランダムに1枚追加
  - `discard_random_active` — アクティブスキルをランダムに1枚廃棄
  - `gain_passive` — パッシブスキルを直接追加
- 完了後 `state.actionPhase = null`、`phase = 'draft'`、`state.actionPhaseSummary` に結果格納

### 4. ドラフトフェーズ (draft)

- スキルデッキから最大8枚公開（プール）
- 全員が同時に1枚選択（モンスター選択と同じ被り解消ルール）
  - 唯一選んだ → 獲得
  - 被り → setAside（再選不可）
  - 最大4回試行後はフォールバック分配
- 残ったプール＋setAsideは墓地へ
- **完了後の進行：**
  - `miniRound < 3` → `miniRound += 1`、`phase = 'event'`
  - `miniRound === 3` かつ `round < 3` → `phase = 'battle'`
  - `miniRound === 3` かつ `round >= 3` → `phase = 'tournament'`

### 5. バトルフェーズ (battle)

- 全プレイヤーをランダムにシャッフルしてペアリング
- 奇数の場合は1人が不戦勝（bye）
- 各試合はバトルエンジンで解決（後述）
- 敗者リストが `state.reward.pendingPlayerIds` に格納される
- 完了後 `phase = 'reward'`

### 6. 報酬フェーズ (reward)

- **対象：** バトルで負けたプレイヤー（勝者・bye・引き分けは対象外）
- **選択肢：**
  - `stat_up` (stat: StatKey) → HP+5 / ATK|DEF|SPD+1
  - `skill_top` → スキルデッキ先頭を獲得
- CPU は greedy ポリシーで自動選択
- 全員確定後 `state.battle = null`、`state.reward = null`
- `round < 3` → `round += 1`、`miniRound = 1`、`phase = 'event'`

### 7. トーナメント (tournament)

- シングルイリミネーション（シャッフル済みブラケット）
- プレイヤー数を2の冪に切り上げて bye で補完
- 引き分けは最大4回再戦（必ず勝者を決定）
- 優勝者を `state.champion` に保存
- 完了後 `phase = 'finished'`

---

## バトルエンジン

### 事前処理

1. モンスターのスナップショットを作成
2. `next_battle` バフを適用して消費
3. バトル開始時パッシブを発動（`trigger.kind === 'battle_start'`）

### イニシアチブ

- 各サイドが d6 + SPD（+ `spd_roll_bonus`）をロール
- 高い方が先攻（同値は再ロール）

### バトルループ

- 先攻・後攻が交互にアクティブスキルを1つずつ使用
- どちらかが未使用スキルを持つ間継続

### スキル効果

| 種類 | 処理 |
|------|------|
| `attack` | ダメージ = max(1, floor(stat × mult × nextAmp + perActiveAmp × 使用数 − DEF)) |
| `true_damage` | DEF・シールド無視のダメージ |
| `heal` | 自分のHP回復 |
| `shield` | 次の被ダメージを軽減（1回限り） |
| `buff_self` | 自分のステータスをバフ（once=次のアクティブのみ / battle=バトル中） |
| `debuff_target` | 相手のステータスをデバフ |
| `next_amp` | 次の攻撃の倍率を設定 |
| `nullify_next` | 相手の次のスキルを無効化 |

### パッシブトリガー

| トリガー | タイミング |
|----------|-----------|
| `battle_start` | バトル開始時 |
| `first_attack` | 最初のアクティブスキル使用時 |
| `on_own_turn_start` | 自分のターン開始時 |
| `on_take_damage` | 被ダメージ時 |

### 勝利判定（アクティブ消費後）

1. 片方HP≤0・他方HP>0 → HP高い方の勝ち（`hp_zero`）
2. 両方HP≤0 → HP高い方の勝ち（`hp_zero`）
3. 両方HP>0 → HP高い方の勝ち（`tiebreak_hp`）
4. HP同値 → SPD高い方の勝ち（`tiebreak_spd`）
5. 全て同値 → 引き分け（`draw`）

---

## モンスター一覧（8体）

| 名前 | HP | ATK | DEF | SPD | 固有パッシブ |
|------|----|-----|-----|-----|-------------|
| フレイモックス | 22 | 7 | 3 | 4 | 初撃の灼熱（first_attack_amp +2） |
| アクアリス | 26 | 4 | 5 | 4 | 清水の加護（turn_start_heal +1） |
| テラゴン | 30 | 5 | 7 | 2 | 岩鎧（damage_reduction -1） |
| ゼピリクス | 20 | 5 | 3 | 8 | 疾風の祝福（spd_roll_bonus +2） |
| ヴォルタンク | 24 | 6 | 6 | 3 | 電磁シールド（1/6でダメージ無効） |
| ウンブラ | 22 | 6 | 4 | 5 | 影討ち（初撃がtrue_damage） |
| ルミベル | 24 | 5 | 5 | 5 | 光の選択（battle_start, ATK/DEFの高い方を+1） |
| クロノア | 20 | 4 | 4 | 6 | （独自パッシブ） |

---

## 命名システム

- スキルカードには `nameTag`（短い名詞タグ）が付いている
- モンスター名は獲得済みタグを `・` で繋いだ文字列（例：パワー・ウィザード・ドラゴン）
- 使用できるタグの種類・数は獲得済みスキルのマルチセットに一致（重複は獲得枚数分まで）
- 最大60文字、最低1パーツ
- バリデーション：`validateMonsterName()` / 使用可能タグ一覧：`getAvailableTags()`

---

## デッキ構成

- **イベントデッキ：** 24枚（枯渇時は墓地をシャッフルして再利用）
- **アクションデッキ：** 48枚（同上 / 8人×初期4枚配布後でも山札に余裕がある枚数）
- **スキルデッキ：** 約70枚（N×28 / R×20 / SR×12 / SSR×4 + パッシブ系）

---

## コードアーキテクチャ

```
src/
├── server/
│   ├── engine/
│   │   ├── types.ts          # 全型定義（GameState, Monster, Skill等）
│   │   ├── state.ts          # 初期状態生成・状態ヘルパー
│   │   ├── naming.ts         # 命名システム
│   │   ├── phases/
│   │   │   ├── monster-pick.ts
│   │   │   ├── event.ts
│   │   │   ├── action.ts
│   │   │   ├── draft.ts
│   │   │   ├── battle.ts
│   │   │   └── reward.ts
│   │   └── cards/
│   │       ├── monsters.ts   # 8体のモンスター定義
│   │       ├── events.ts     # イベントカード24枚
│   │       ├── actions.ts    # アクションカード32枚
│   │       └── skills.ts     # スキルカード群
│   ├── game-runner.ts        # フェーズ進行管理・クライアント状態変換
│   └── ws-server.ts          # WebSocket接続・タイミング制御
├── shared/
│   └── messages.ts           # クライアント↔サーバー型（ClientGameState等）
├── lib/
│   ├── skill-text.ts         # スキル効果のテキスト化
│   ├── card-text.ts          # カード効果のテキスト化
│   ├── colors.ts             # プレイヤー色定義
│   └── useGameSocket.ts      # WebSocket React hook
└── components/
    ├── Game.tsx              # フェーズルーター
    └── game/
        ├── MonsterPickView.tsx
        ├── DraftView.tsx
        ├── EventPhaseView.tsx
        ├── ActionPhaseView.tsx
        ├── BattleAnimationView.tsx
        ├── RewardView.tsx
        ├── ChampionView.tsx
        ├── MyMonsterPanel.tsx
        ├── PlayerPanel.tsx
        ├── DeckInspector.tsx
        └── SkillNameHover.tsx
```

### 重要な設計メモ

- `GameRunner` の `pauseOnReveal: boolean`（デフォルト false）：ドラフト被り解消時に `revealing=true` でブロードキャストを挟む。ws-server が 3s 後に `resolveDraftSubRoundNow()` を呼ぶ。テストでは false のまま同期解決。
- `battleResolvedSinceConsume` / `eventResolvedSinceConsume` / `actionResolvedSinceConsume`：フェーズ完了をws-serverに通知するフラグ（`advance()` 内でセット）。
- バトルアニメーション：ws-server が `maybeBattleAnimationPause()` で `broadcastGameStateWithPhase(room, 'battle')` を使い、バトルが終わっても一定時間 battle フェーズをクライアントに表示。
- `publicDecks`：テスト用にイベント・アクションデッキの中身をクライアントに公開。スキルデッキは公平性のため非公開。
