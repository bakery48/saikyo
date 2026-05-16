import type { ActionCard } from '../types';
import rawOverrides from './actions.overrides.json';

export const ACTIONS: ActionCard[] = [
  // ── stat_mod ────────────────────────────────────────────────────────────────
  { id: 'ac-atk2',  name: 'ATK強化',    effect: { kind: 'stat_mod', stat: 'atk', amount: 2 }, count: 6 },
  { id: 'ac-def2',  name: 'DEF強化',    effect: { kind: 'stat_mod', stat: 'def', amount: 2 }, count: 6 },
  { id: 'ac-spd2',  name: 'SPD強化',    effect: { kind: 'stat_mod', stat: 'spd', amount: 2 }, count: 6 },
  { id: 'ac-hp3',   name: 'HP回復',     effect: { kind: 'stat_mod', stat: 'hp',  amount: 3 }, count: 6 },
  // ── stat_mod_choice ─────────────────────────────────────────────────────────
  { id: 'ac-choice2', name: '汎用訓練', effect: { kind: 'stat_mod_choice', amount: 2, stats: ['atk', 'def', 'spd'] }, count: 10 },

  // ── スキル操作 ───────────────────────────────────────────────────────────────
  { id: 'ac-draw',    name: '探索',     effect: { kind: 'draw_skill_top' },            count: 6 },
  { id: 'ac-grave',   name: '墓場あさり', effect: { kind: 'recover_skill_from_grave' }, count: 5 },
  { id: 'ac-discard', name: 'スキル整理', effect: { kind: 'discard_random_active' },   count: 2 },
  { id: 'ac-slot',    name: 'スキル直結', effect: { kind: 'slot_top_skill' },          count: 1 },
  { id: 'ac-upgrade', name: 'スキル昇格', effect: { kind: 'upgrade_skill' },           count: 1 },
  { id: 'ac-copy',    name: '技術盗用',  effect: { kind: 'copy_skill_from_player' },   count: 1 },

  // ── 相手操作・強奪 ───────────────────────────────────────────────────────────
  { id: 'ac-steal-atk', name: 'ATK強奪', effect: { kind: 'steal_stat', stat: 'atk', amount: 2 }, count: 1 },
  { id: 'ac-steal-spd', name: 'SPD強奪', effect: { kind: 'steal_stat', stat: 'spd', amount: 2 }, count: 1 },
  { id: 'ac-steal-def', name: 'DEF強奪', effect: { kind: 'steal_stat', stat: 'def', amount: 2 }, count: 1 },
  { id: 'ac-steal-hp',  name: 'HP奪取',  effect: { kind: 'steal_stat', stat: 'hp',  amount: 4 }, count: 1 },
  { id: 'ac-copy-atk',  name: 'ATK模倣', effect: { kind: 'copy_stat_from_leader', stat: 'atk' }, count: 1 },
  { id: 'ac-copy-spd',  name: 'SPD模倣', effect: { kind: 'copy_stat_from_leader', stat: 'spd' }, count: 1 },
  { id: 'ac-swap',      name: 'スキル順入れ替え', effect: { kind: 'swap_actives' }, count: 1 },
  { id: 'ac-swap-all',  name: '全能大交換', effect: { kind: 'swap_all_stats' }, count: 1 },

  // ── ステータス変換 ───────────────────────────────────────────────────────────
  { id: 'ac-def2atk', name: 'DEF→ATK変換', effect: { kind: 'trade_stat', from: 'def', to: 'atk', fromAmount: 3, toAmount: 4 }, count: 1 },
  { id: 'ac-atk2spd', name: 'ATK→SPD変換', effect: { kind: 'trade_stat', from: 'atk', to: 'spd', fromAmount: 2, toAmount: 3 }, count: 1 },
  { id: 'ac-spd2atk', name: 'SPD→ATK変換', effect: { kind: 'trade_stat', from: 'spd', to: 'atk', fromAmount: 3, toAmount: 4 }, count: 1 },
  { id: 'ac-hp2atk',  name: 'HP→ATK変換',  effect: { kind: 'trade_stat', from: 'hp',  to: 'atk', fromAmount: 6, toAmount: 4 }, count: 1 },
  { id: 'ac-def2hp',  name: 'DEF→HP変換',  effect: { kind: 'trade_stat', from: 'def', to: 'hp',  fromAmount: 2, toAmount: 5 }, count: 1 },
  { id: 'ac-hp2atk2', name: '体力変換',     effect: { kind: 'hp_to_atk', fraction: 0.2 }, count: 1 },

  // ── 全能・スケール ───────────────────────────────────────────────────────────
  { id: 'ac-allmod1', name: '全能強化',   effect: { kind: 'all_stats_mod', amount: 1 }, count: 1 },
  { id: 'ac-allmod2', name: '超全能強化', effect: { kind: 'all_stats_mod', amount: 2 }, count: 1 },
  { id: 'ac-round',   name: '時の恩恵',   effect: { kind: 'round_scaled_stat_mod', stat: 'atk', perRound: 2 }, count: 1 },

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
