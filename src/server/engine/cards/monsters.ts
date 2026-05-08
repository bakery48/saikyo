import type { MonsterBase } from '../types';

export const MONSTERS: MonsterBase[] = [
  {
    baseId: 'flameox',
    name: 'フレイモックス',
    stats: { hp: 22, atk: 7, def: 3, spd: 4 },
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
    stats: { hp: 26, atk: 4, def: 5, spd: 4 },
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
    stats: { hp: 30, atk: 5, def: 7, spd: 2 },
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
    stats: { hp: 20, atk: 5, def: 3, spd: 8 },
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
    stats: { hp: 24, atk: 6, def: 6, spd: 3 },
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
    stats: { hp: 22, atk: 6, def: 4, spd: 5 },
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
    stats: { hp: 24, atk: 5, def: 5, spd: 5 },
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
    baseId: 'chronoa',
    name: 'クロノア',
    stats: { hp: 20, atk: 4, def: 4, spd: 6 },
    passives: [
      {
        id: 'chronoa-p1',
        name: '時の積層',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'amp_each_active', amount: 1 },
      },
    ],
  },
];

export const MONSTERS_BY_ID: Record<string, MonsterBase> = Object.fromEntries(
  MONSTERS.map((m) => [m.baseId, m]),
);
