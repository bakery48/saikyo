import type { MonsterBase } from '../types';

export const MONSTERS: MonsterBase[] = [
  {
    baseId: 'flameox',
    name: 'フレイモックス',
    stats: { hp: 12, atk: 7, def: 3, spd: 4 },
    passives: [
      {
        id: 'flameox-p1',
        name: '初撃の灼熱',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'first_attack_amp', amount: 2 },
      },
    ],
  },
  {
    baseId: 'aqualith',
    name: 'アクアリス',
    stats: { hp: 16, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'aqualith-p1',
        name: '清水の加護',
        trigger: { kind: 'on_own_turn_start' },
        effect: { kind: 'turn_start_heal', amount: 1 },
      },
    ],
  },
  {
    baseId: 'terragon',
    name: 'テラゴン',
    stats: { hp: 20, atk: 5, def: 7, spd: 2 },
    passives: [
      {
        id: 'terragon-p1',
        name: '岩鎧',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'damage_reduction', amount: 1 },
      },
    ],
  },
  {
    baseId: 'zephyrix',
    name: 'ゼピリクス',
    stats: { hp: 10, atk: 5, def: 3, spd: 8 },
    passives: [
      {
        id: 'zephyrix-p1',
        name: '疾風の祝福',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'spd_roll_bonus', amount: 2 },
      },
    ],
  },
  {
    baseId: 'voltank',
    name: 'ヴォルタンク',
    stats: { hp: 14, atk: 6, def: 6, spd: 3 },
    passives: [
      {
        id: 'voltank-p1',
        name: '電磁シールド',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'damage_negate_chance', oneIn: 6 },
      },
    ],
  },
  {
    baseId: 'umbrafox',
    name: 'ウンブラ',
    stats: { hp: 12, atk: 6, def: 4, spd: 5 },
    passives: [
      {
        id: 'umbrafox-p1',
        name: '影討ち',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'first_attack_true' },
      },
    ],
  },
  {
    baseId: 'lumibell',
    name: 'ルミベル',
    stats: { hp: 14, atk: 5, def: 5, spd: 5 },
    passives: [
      {
        id: 'lumibell-p1',
        name: '光の選択',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'pick_higher_buff', amount: 1 },
      },
    ],
  },
  {
    baseId: 'ouroboros',
    name: 'ウロボロス',
    stats: { hp: 10, atk: 3, def: 4, spd: 6 },
    passives: [
      {
        id: 'ouroboros-p1',
        name: '時の積層',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'atk_per_active', amount: 1 },
      },
    ],
  },
  {
    baseId: 'dracula',
    name: 'ドラキュラ',
    stats: { hp: 8, atk: 6, def: 3, spd: 5 },
    passives: [
      {
        id: 'dracula-p1',
        name: '吸血',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'lifesteal', denominator: 2 },
      },
    ],
  },
  {
    baseId: 'phoenix',
    name: 'フェニックス',
    stats: { hp: 12, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'phoenix-p1',
        name: '食いしばり',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'endure_fatal' },
      },
    ],
  },
];

export const MONSTERS_BY_ID: Record<string, MonsterBase> = Object.fromEntries(
  MONSTERS.map((m) => [m.baseId, m]),
);
