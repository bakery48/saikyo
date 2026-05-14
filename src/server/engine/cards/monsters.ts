import type { MonsterBase } from '../types';
import rawOverrides from './monsters.overrides.json';

export const MONSTERS: MonsterBase[] = [
  {
    baseId: 'demon',
    name: 'デーモン',
    attackKind: 'claw',
    stats: { hp: 18, atk: 6, def: 6, spd: 2 },
    passives: [
      {
        id: 'demon-p1',
        name: '悪の目醒め',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'first_attack_damage_mult', mult: 2 },
      },
    ],
  },
  {
    baseId: 'unicorn',
    name: 'ユニコーン',
    attackKind: 'strike',
    stats: { hp: 16, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'unicorn-p1',
        name: '清廉潔白',
        trigger: { kind: 'on_own_turn_start' },
        effect: { kind: 'turn_start_heal', amount: 2 },
      },
    ],
  },
  {
    baseId: 'golem',
    name: 'ゴーレム',
    attackKind: 'strike',
    stats: { hp: 20, atk: 5, def: 7, spd: 2 },
    passives: [
      {
        id: 'golem-p1',
        name: '岩鎧',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'damage_reduction', amount: 2 },
      },
    ],
  },
  {
    baseId: 'fenrir',
    name: 'フェンリル',
    attackKind: 'claw',
    stats: { hp: 10, atk: 5, def: 3, spd: 8 },
    passives: [
      {
        id: 'fenrir-p1',
        name: '疾風の祝福',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'spd_roll_bonus', amount: 3 },
      },
    ],
  },
  {
    baseId: 'fairy',
    name: 'フェアリー',
    attackKind: 'sword',
    stats: { hp: 10, atk: 5, def: 3, spd: 6 },
    passives: [
      {
        id: 'fairy-p1',
        name: '妖しい舞踊',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'dodge_bonus', percent: 20 },
      },
    ],
  },
  {
    baseId: 'wyvern',
    name: 'ワイバーン',
    attackKind: 'claw',
    stats: { hp: 8, atk: 6, def: 3, spd: 7 },
    passives: [
      {
        id: 'wyvern-p1',
        name: '急襲の本能',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'first_attack_true' },
      },
    ],
  },
  {
    baseId: 'slime',
    name: 'スライム',
    attackKind: 'strike',
    stats: { hp: 14, atk: 5, def: 5, spd: 5 },
    passives: [
      {
        id: 'slime-p1',
        name: '形なき適応',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'pick_higher_buff_mult', mult: 1.5 },
      },
    ],
  },
  {
    baseId: 'ouroboros',
    name: 'ウロボロス',
    attackKind: 'magic',
    stats: { hp: 10, atk: 3, def: 4, spd: 6 },
    passives: [
      {
        id: 'ouroboros-p1',
        name: '時の輪廻',
        trigger: { kind: 'on_own_active_used' },
        effect: { kind: 'atk_per_active', amount: 1 },
      },
    ],
  },
  {
    baseId: 'vampire',
    name: 'ヴァンパイア',
    attackKind: 'claw',
    stats: { hp: 8, atk: 6, def: 3, spd: 5 },
    passives: [
      {
        id: 'vampire-p1',
        name: '吸血',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'lifesteal', denominator: 2 },
      },
    ],
  },
  {
    baseId: 'phoenix',
    name: 'フェニックス',
    attackKind: 'magic',
    stats: { hp: 12, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'phoenix-p1',
        name: '不死鳥の加護',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'endure_fatal', reviveDenominator: 4 },
      },
    ],
  },
  {
    baseId: 'berserker',
    name: 'バーサーカー',
    attackKind: 'sword',
    stats: { hp: 8, atk: 7, def: 2, spd: 5 },
    passives: [
      {
        id: 'berserker-p1',
        name: '怒りの咆哮',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'rage_atk', amount: 1 },
      },
    ],
  },
  {
    baseId: 'wizard',
    name: 'ウィザード',
    attackKind: 'magic',
    stats: { hp: 12, atk: 3, def: 5, spd: 5 },
    passives: [
      {
        id: 'wizard-p1',
        name: '装甲呪詛',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'hex_def', amount: 1 },
      },
    ],
  },
  {
    baseId: 'cerberus',
    name: 'ケルベロス',
    attackKind: 'claw',
    stats: { hp: 12, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'cerberus-p1',
        name: '連携攻撃',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'extra_attack_chance', percent: 10 },
      },
    ],
  },
  {
    baseId: 'carbuncle',
    name: 'カーバンクル',
    attackKind: 'magic',
    stats: { hp: 14, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'carbuncle-p1',
        name: '宝玉の反射',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'counter_damage', denominator: 3 },
      },
    ],
  },
  {
    baseId: 'scarab',
    name: 'スカラベ',
    attackKind: 'magic',
    stats: { hp: 14, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'scarab-p1',
        name: '聖甲虫の加護',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'absorb_first_hit' },
      },
    ],
  },
  {
    baseId: 'dragon',
    name: 'ドラゴン',
    attackKind: 'claw',
    stats: { hp: 9, atk: 5, def: 2, spd: 6 },
    passives: [
      {
        id: 'dragon-p1',
        name: '紅龍の鱗',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'mid_damage_immune', min: 4, max: 9 },
      },
    ],
  },
  {
    baseId: 'goblin',
    name: 'ゴブリン',
    attackKind: 'strike',
    stats: { hp: 12, atk: 4, def: 3, spd: 6 },
    passives: [
      {
        id: 'goblin-p1',
        name: 'チクチク攻撃',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'low_damage_bonus', threshold: 2, bonus: 3 },
      },
    ],
  },
  {
    baseId: 'griffon',
    name: 'グリフォン',
    attackKind: 'claw',
    stats: { hp: 13, atk: 3, def: 4, spd: 6 },
    passives: [
      {
        id: 'griffon-p1',
        name: '飛翔斬',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'pierce_all_shields' },
      },
    ],
  },
  {
    baseId: 'bug',
    name: 'バグ',
    attackKind: 'magic',
    hidden: true,
    stats: { hp: 10, atk: 5, def: 5, spd: 5 },
    passives: [
      {
        id: 'bug-p1',
        name: '崩壊する身体',
        trigger: { kind: 'on_own_active_used' },
        effect: { kind: 'self_decay', hp: 3, atk: 2, def: 2, spd: 2 },
      },
    ],
  },
  {
    baseId: 'knight',
    name: 'ナイト',
    attackKind: 'sword',
    stats: { hp: 14, atk: 5, def: 5, spd: 3 },
    passives: [
      {
        id: 'knight-p1',
        name: '背水の覚悟',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'low_hp_atk_mult', mult: 2, thresholdFraction: 0.5 },
      },
    ],
  },
  {
    baseId: 'ghost',
    name: 'ゴースト',
    attackKind: 'strike',
    stats: { hp: 16, atk: 4, def: 8, spd: 3 },
    passives: [
      {
        id: 'ghost-p1',
        name: '鉄壁の誓い',
        trigger: { kind: 'on_last_active_used' },
        effect: { kind: 'grant_ghost_shield_on_last_active', amount: 99 },
      },
    ],
  },
];

type PassiveOverride = { description?: string };
const passiveOverrides = rawOverrides as Record<string, PassiveOverride>;

if (Object.keys(passiveOverrides).length > 0) {
  for (const m of MONSTERS) {
    for (const p of m.passives) {
      const ov = passiveOverrides[p.id];
      if (!ov) continue;
      if (ov.description !== undefined) p.description = ov.description;
    }
  }
}

export const MONSTERS_BY_ID: Record<string, MonsterBase> = Object.fromEntries(
  MONSTERS.map((m) => [m.baseId, m]),
);
