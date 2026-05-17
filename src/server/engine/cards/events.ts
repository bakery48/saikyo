import type { EventCard } from '../types';
import rawOverrides from './events.overrides.json';

export const EVENTS: EventCard[] = [
  // ── heal ────────────────────────────────────────────────────────────────────
  { id: 'ev-019', name: '逆転の女神',   target: 'lowestHp',  effect: { kind: 'stat_mod', stat: 'hp', amount: 12 } },

  // ── stat_mod (all) ──────────────────────────────────────────────────────────
  { id: 'ev-002', name: '荒野の風',     target: 'all',       effect: { kind: 'stat_mod', stat: 'spd', amount: 4  }, count: 3 },
  { id: 'ev-003', name: '武闘大会',     target: 'all',       effect: { kind: 'stat_mod', stat: 'atk', amount: 4  }, count: 2 },
  { id: 'ev-004', name: '砦の壁',       target: 'all',       effect: { kind: 'stat_mod', stat: 'def', amount: 4  }, count: 2 },
  { id: 'ev-005', name: '滋養の地',     target: 'all',       effect: { kind: 'stat_mod', stat: 'hp',  amount: 24 }, count: 2 },
  { id: 'ev-028', name: '城壁の崩壊',   target: 'all',       effect: { kind: 'stat_mod', stat: 'def', amount: -4 }, count: 2 },
  { id: 'ev-n01', name: '闘志の衰退',   target: 'all',       effect: { kind: 'stat_mod', stat: 'atk', amount: -4 } },
  { id: 'ev-n02', name: '重力の呪い',   target: 'all',       effect: { kind: 'stat_mod', stat: 'spd', amount: -4 } },
  { id: 'ev-n03', name: '大飢饉',       target: 'all',       effect: { kind: 'stat_mod', stat: 'hp',  amount: -24 } },

  // ── stat_mod (targeted) ─────────────────────────────────────────────────────
  { id: 'ev-011', name: '嵐の使者',     target: 'random',     effect: { kind: 'stat_mod', stat: 'spd', amount: 2 } },
  { id: 'ev-r01', name: '戦火の使者',   target: 'random',     effect: { kind: 'stat_mod', stat: 'atk', amount: 2 } },
  { id: 'ev-r02', name: '鉄壁の使者',   target: 'random',     effect: { kind: 'stat_mod', stat: 'def', amount: 2 } },
  { id: 'ev-r03', name: '稲妻の使者',   target: 'random',     effect: { kind: 'stat_mod', stat: 'hp',  amount: 12 } },
  { id: 'ev-013', name: '集中特訓',     target: 'lowestAtk',  effect: { kind: 'stat_mod', stat: 'atk', amount: 3 } },
  { id: 'ev-018', name: '天才教師',     target: 'lowestDef',  effect: { kind: 'stat_mod', stat: 'def', amount: 3 } },
  { id: 'ev-l01', name: '弱者の猛訓練', target: 'lowestSpd',  effect: { kind: 'stat_mod', stat: 'spd', amount: 3 } },
  { id: 'ev-l02', name: '弱者への追い打ち', target: 'lowestHp', effect: { kind: 'stat_mod', stat: 'hp',  amount: -6 } },
  { id: 'ev-l03', name: '弱者の足枷',   target: 'lowestAtk',  effect: { kind: 'stat_mod', stat: 'atk', amount: -1 } },
  { id: 'ev-l04', name: '弱者の重荷',   target: 'lowestDef',  effect: { kind: 'stat_mod', stat: 'def', amount: -1 } },
  { id: 'ev-l05', name: '弱者の縛り',   target: 'lowestSpd',  effect: { kind: 'stat_mod', stat: 'spd', amount: -1 } },
  // ── highest stat (8種) ──────────────────────────────────────────────────────
  { id: 'ev-h01', name: 'HP覇者の恵み', target: 'highestHp',  effect: { kind: 'stat_mod', stat: 'hp',  amount:  6 } },
  { id: 'ev-h02', name: 'HP覇者の代償', target: 'highestHp',  effect: { kind: 'stat_mod', stat: 'hp',  amount: -12 } },
  { id: 'ev-h03', name: 'ATK覇者の恵み', target: 'highestAtk', effect: { kind: 'stat_mod', stat: 'atk', amount:  1 } },
  { id: 'ev-h04', name: 'ATK覇者の代償', target: 'highestAtk', effect: { kind: 'stat_mod', stat: 'atk', amount: -2 } },
  { id: 'ev-h05', name: 'DEF覇者の恵み', target: 'highestDef', effect: { kind: 'stat_mod', stat: 'def', amount:  1 } },
  { id: 'ev-h06', name: 'DEF覇者の代償', target: 'highestDef', effect: { kind: 'stat_mod', stat: 'def', amount: -2 } },
  { id: 'ev-h07', name: 'SPD覇者の恵み', target: 'highestSpd', effect: { kind: 'stat_mod', stat: 'spd', amount:  1 } },
  { id: 'ev-h08', name: 'SPD覇者の代償', target: 'highestSpd', effect: { kind: 'stat_mod', stat: 'spd', amount: -2 } },

  // ── damage ──────────────────────────────────────────────────────────────────
  { id: 'ev-010', name: '稲妻の試練',   target: 'random',     effect: { kind: 'damage', amount: 5 } },

  // ── add_skill_top ───────────────────────────────────────────────────────────
  { id: 'ev-009', name: '気まぐれな神', target: 'random',     effect: { kind: 'add_skill_top' }, count: 3 },
  { id: 'ev-033', name: '技術の共有',   target: 'all',        effect: { kind: 'add_skill_top' } },

  // ── global effects ──────────────────────────────────────────────────────────
  { id: 'ev-025', name: '時逆の風',     target: 'all',        effect: { kind: 'reverse_actives_next_battle' } },


  { id: 'ev-s01', name: '矛と盾の逆転', target: 'all',        effect: { kind: 'swap_two_stats', statA: 'atk', statB: 'def' } },
  { id: 'ev-s02', name: '速攻の皮肉',   target: 'all',        effect: { kind: 'swap_two_stats', statA: 'atk', statB: 'spd' } },
  { id: 'ev-s03', name: '堅牢と俊足',   target: 'all',        effect: { kind: 'swap_two_stats', statA: 'def', statB: 'spd' } },
  { id: 'ev-031', name: 'HP平等の奇跡',  target: 'all',        effect: { kind: 'average_hp' } },
  { id: 'ev-a01', name: 'ATK平等の奇跡', target: 'all',       effect: { kind: 'average_stat', stat: 'atk' } },
  { id: 'ev-a02', name: 'DEF平等の奇跡', target: 'all',       effect: { kind: 'average_stat', stat: 'def' } },
  { id: 'ev-a03', name: 'SPD平等の奇跡', target: 'all',       effect: { kind: 'average_stat', stat: 'spd' } },
  { id: 'ev-034', name: '閃きの時',     target: 'all',        effect: { kind: 'draw_action_card' } },
  { id: 'ev-035', name: '世界侵食',     target: 'all',        effect: { kind: 'all_stats_mod', amount: -2 } },
  { id: 'ev-w01', name: '世界の祝福',   target: 'all',        effect: { kind: 'all_stats_mod', amount:  2 } },

  // ── targeted special ────────────────────────────────────────────────────────
  { id: 'ev-030', name: '旋風',         target: 'random',     effect: { kind: 'shuffle_actives' } },
  { id: 'ev-032', name: '大徴収',       target: 'all',        effect: { kind: 'discard_action_card' } },
  { id: 'ev-048', name: 'スキル強奪',   target: 'random',     effect: { kind: 'steal_skill' } },
  { id: 'ev-p01', name: 'スキル市場',   target: 'all',        effect: { kind: 'pool_and_redistribute_skills', count: 2 } },
  { id: 'ev-c01', name: '大粛清',       target: 'all',        effect: { kind: 'clear_all_stocks' } },

];

type EventOverride = { description?: string };
const eventOverrides = rawOverrides as Record<string, EventOverride>;
if (Object.keys(eventOverrides).length > 0) {
  for (const card of EVENTS) {
    const ov = eventOverrides[card.id];
    if (ov?.description !== undefined) card.description = ov.description;
  }
}
