import type { EventCard } from '../types';
import rawOverrides from './events.overrides.json';

export const EVENTS: EventCard[] = [
  // ── heal ────────────────────────────────────────────────────────────────────
  { id: 'ev-001', name: '豊穣の雨',     target: 'all',       effect: { kind: 'heal', amount: 3 } },
  { id: 'ev-012', name: '太陽の祝福',   target: 'all',       effect: { kind: 'heal', amount: 5 } },
  { id: 'ev-022', name: '休息の宿屋',   target: 'all',       effect: { kind: 'heal', amount: 2 } },
  { id: 'ev-019', name: '逆転の女神',   target: 'lowestHp',  effect: { kind: 'heal', amount: 6 } },

  // ── stat_mod (all) ──────────────────────────────────────────────────────────
  { id: 'ev-002', name: '荒野の風',     target: 'all',       effect: { kind: 'stat_mod', stat: 'spd', amount: 4  }, count: 3 },
  { id: 'ev-003', name: '武闘大会',     target: 'all',       effect: { kind: 'stat_mod', stat: 'atk', amount: 4  }, count: 2 },
  { id: 'ev-004', name: '砦の壁',       target: 'all',       effect: { kind: 'stat_mod', stat: 'def', amount: 4  }, count: 2 },
  { id: 'ev-005', name: '滋養の地',     target: 'all',       effect: { kind: 'stat_mod', stat: 'hp',  amount: 20 }, count: 2 },
  { id: 'ev-028', name: '城壁の崩壊',   target: 'all',       effect: { kind: 'stat_mod', stat: 'def', amount: -4 }, count: 2 },

  // ── stat_mod (targeted) ─────────────────────────────────────────────────────
  { id: 'ev-011', name: '嵐の使者',     target: 'random',     effect: { kind: 'stat_mod', stat: 'spd', amount: 2 } },
  { id: 'ev-013', name: '集中特訓',     target: 'lowestHp',   effect: { kind: 'stat_mod', stat: 'atk', amount: 2 } },
  { id: 'ev-018', name: '天才教師',     target: 'lowestHp',   effect: { kind: 'stat_mod', stat: 'def', amount: 2 } },
  { id: 'ev-040', name: '弱者の奮起',   target: 'lowestHp',   effect: { kind: 'stat_mod', stat: 'atk', amount: 5 } },
  { id: 'ev-042', name: '弱者の盾',     target: 'lowestHp',   effect: { kind: 'stat_mod', stat: 'def', amount: 4 } },
  { id: 'ev-045', name: '才能の爆発',   target: 'random',     effect: { kind: 'stat_mod', stat: 'atk', amount: 6 } },
  // ── highest stat (8種) ──────────────────────────────────────────────────────
  { id: 'ev-h01', name: 'HP覇者の恵み', target: 'highestHp',  effect: { kind: 'stat_mod', stat: 'hp',  amount:  5 } },
  { id: 'ev-h02', name: 'HP覇者の代償', target: 'highestHp',  effect: { kind: 'stat_mod', stat: 'hp',  amount: -5 } },
  { id: 'ev-h03', name: 'ATK覇者の恵み', target: 'highestAtk', effect: { kind: 'stat_mod', stat: 'atk', amount:  1 } },
  { id: 'ev-h04', name: 'ATK覇者の代償', target: 'highestAtk', effect: { kind: 'stat_mod', stat: 'atk', amount: -1 } },
  { id: 'ev-h05', name: 'DEF覇者の恵み', target: 'highestDef', effect: { kind: 'stat_mod', stat: 'def', amount:  1 } },
  { id: 'ev-h06', name: 'DEF覇者の代償', target: 'highestDef', effect: { kind: 'stat_mod', stat: 'def', amount: -1 } },
  { id: 'ev-h07', name: 'SPD覇者の恵み', target: 'highestSpd', effect: { kind: 'stat_mod', stat: 'spd', amount:  1 } },
  { id: 'ev-h08', name: 'SPD覇者の代償', target: 'highestSpd', effect: { kind: 'stat_mod', stat: 'spd', amount: -1 } },

  // ── damage ──────────────────────────────────────────────────────────────────
  { id: 'ev-006', name: '災厄の流星',   target: 'all',        effect: { kind: 'damage', amount: 3 } },
  { id: 'ev-007', name: '弱者狩り',     target: 'lowestHp',   effect: { kind: 'damage', amount: 4 } },
  { id: 'ev-010', name: '稲妻の試練',   target: 'random',     effect: { kind: 'damage', amount: 5 } },
  { id: 'ev-017', name: '沼地の毒霧',   target: 'all',        effect: { kind: 'damage', amount: 2 } },

  // ── add_skill_top ───────────────────────────────────────────────────────────
  { id: 'ev-009', name: '気まぐれな神', target: 'random',     effect: { kind: 'add_skill_top' }, count: 3 },
  { id: 'ev-033', name: '技術の共有',   target: 'all',        effect: { kind: 'add_skill_top' } },

  // ── global effects ──────────────────────────────────────────────────────────
  { id: 'ev-025', name: '時逆の風',     target: 'all',        effect: { kind: 'reverse_actives_next_battle' } },
  { id: 'ev-026', name: '休戦命令',     target: 'all',        effect: { kind: 'skip_action_phase' } },

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
  { id: 'ev-r01', name: 'スキル流通',   target: 'all',        effect: { kind: 'rotate_skill' } },
  { id: 'ev-d01', name: 'スキル消失',   target: 'random',     effect: { kind: 'discard_skills', count: 2 } },
];

type EventOverride = { description?: string };
const eventOverrides = rawOverrides as Record<string, EventOverride>;
if (Object.keys(eventOverrides).length > 0) {
  for (const card of EVENTS) {
    const ov = eventOverrides[card.id];
    if (ov?.description !== undefined) card.description = ov.description;
  }
}
