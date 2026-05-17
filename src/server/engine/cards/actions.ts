import type { ActionCard } from '../types';
import rawOverrides from './actions.overrides.json';

export const ACTIONS: ActionCard[] = [
  // ── stat_mod ────────────────────────────────────────────────────────────────
  { id: 'ac-atk2',  name: '瓦割り',       effect: { kind: 'stat_mod', stat: 'atk', amount: 2 }, count: 6 },
  { id: 'ac-def2',  name: '滝行',         effect: { kind: 'stat_mod', stat: 'def', amount: 2 }, count: 6 },
  { id: 'ac-spd2',  name: '坂道ダッシュ', effect: { kind: 'stat_mod', stat: 'spd', amount: 2 }, count: 6 },
  { id: 'ac-hp3',   name: '走り込み',     effect: { kind: 'stat_mod', stat: 'hp',  amount: 3 }, count: 6 },
  // ── stat_mod_choice ─────────────────────────────────────────────────────────
  { id: 'ac-choice2', name: '汎用訓練', effect: { kind: 'stat_mod_choice', amount: 2, stats: ['atk', 'def', 'spd'] }, count: 10 },

  // ── スキル操作 ───────────────────────────────────────────────────────────────
  { id: 'ac-draw',    name: '探索',     effect: { kind: 'draw_skill_top_with_stat_loss', amount: 1 }, count: 6 },
  { id: 'ac-discard', name: 'スキル整理', effect: { kind: 'discard_actives_gain_stat', discardCount: 2, amount: 3, stats: ['atk', 'def', 'spd'] }, count: 2 },
  { id: 'ac-copy',    name: '見よう見まね', effect: { kind: 'copy_skill_from_player' }, count: 1 },

  // ── 相手操作・強奪 ───────────────────────────────────────────────────────────
  { id: 'ac-steal-atk', name: 'ATK強奪', effect: { kind: 'steal_stat', stat: 'atk', amount: 1 }, count: 1 },
  { id: 'ac-steal-spd', name: 'SPD強奪', effect: { kind: 'steal_stat', stat: 'spd', amount: 1 }, count: 1 },
  { id: 'ac-steal-def', name: 'DEF強奪', effect: { kind: 'steal_stat', stat: 'def', amount: 1 }, count: 1 },
  { id: 'ac-steal-hp',  name: 'HP奪取',  effect: { kind: 'steal_stat', stat: 'hp',  amount: 6 }, count: 1 },
  { id: 'ac-copy-atk',  name: 'ATK模倣', effect: { kind: 'copy_stat_from_leader', stat: 'atk' }, count: 1 },
  { id: 'ac-copy-spd',  name: 'SPD模倣', effect: { kind: 'copy_stat_from_leader', stat: 'spd' }, count: 1 },
  { id: 'ac-swap-all',  name: '全能大交換', effect: { kind: 'swap_all_stats' }, count: 1 },

  // ── ステータス変換 ───────────────────────────────────────────────────────────
  // ── 変換（ATK/DEF/SPD/HPの全12パターン） ─────────────────────────────────
  { id: 'ac-atk2def', name: '防御特訓',         effect: { kind: 'trade_stat', from: 'atk', to: 'def', fromAmount: 3, toAmount: 3  }, count: 1 },
  { id: 'ac-atk2spd', name: '居合抜き',   effect: { kind: 'trade_stat', from: 'atk', to: 'spd', fromAmount: 3, toAmount: 3  }, count: 1 },
  { id: 'ac-atk2hp',  name: '根性注入',   effect: { kind: 'trade_stat', from: 'atk', to: 'hp',  fromAmount: 3, toAmount: 18 }, count: 1 },
  { id: 'ac-def2atk', name: 'がむしゃら攻撃練習', effect: { kind: 'trade_stat', from: 'def', to: 'atk', fromAmount: 3, toAmount: 3  }, count: 1 },
  { id: 'ac-def2spd', name: '身軽稽古',   effect: { kind: 'trade_stat', from: 'def', to: 'spd', fromAmount: 3, toAmount: 3  }, count: 1 },
  { id: 'ac-def2hp',  name: '硬化訓練',   effect: { kind: 'trade_stat', from: 'def', to: 'hp',  fromAmount: 3, toAmount: 18 }, count: 1 },
  { id: 'ac-spd2atk', name: '踏み込み',   effect: { kind: 'trade_stat', from: 'spd', to: 'atk', fromAmount: 3, toAmount: 3  }, count: 1 },
  { id: 'ac-spd2def', name: '増量修行',   effect: { kind: 'trade_stat', from: 'spd', to: 'def', fromAmount: 3, toAmount: 3  }, count: 1 },
  { id: 'ac-spd2hp',  name: '持久鍛錬',   effect: { kind: 'trade_stat', from: 'spd', to: 'hp',  fromAmount: 3, toAmount: 18 }, count: 1 },
  { id: 'ac-hp2atk',  name: '捨て身修行', effect: { kind: 'trade_stat', from: 'hp',  to: 'atk', fromAmount: 18, toAmount: 3 }, count: 1 },
  { id: 'ac-hp2def',  name: '痛みに慣れる', effect: { kind: 'trade_stat', from: 'hp',  to: 'def', fromAmount: 18, toAmount: 3 }, count: 1 },
  { id: 'ac-hp2spd',  name: '減量修行',   effect: { kind: 'trade_stat', from: 'hp',  to: 'spd', fromAmount: 18, toAmount: 3 }, count: 1 },

  // ── 全能・スケール ───────────────────────────────────────────────────────────
  { id: 'ac-allmod1', name: '汎用特訓', effect: { kind: 'all_stats_mod', amount: 1 }, count: 1 },


  // ── その他 ──────────────────────────────────────────────────────────────────
  { id: 'ac-cleanse', name: '解呪',    effect: { kind: 'cleanse_sin' }, count: 2 },
  { id: 'ac-bug',     name: 'バグ発生', effect: { kind: 'become_bug' }, count: 1 },
];

type ActionOverride = { description?: string };
const actionOverrides = rawOverrides as Record<string, ActionOverride>;
if (Object.keys(actionOverrides).length > 0) {
  for (const card of ACTIONS) {
    const ov = actionOverrides[card.id];
    if (ov?.description !== undefined) card.description = ov.description;
  }
}
