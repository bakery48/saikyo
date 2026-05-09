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
    baseId: 'golem',
    name: 'ゴーレム',
    stats: { hp: 20, atk: 5, def: 7, spd: 2 },
    passives: [
      {
        id: 'golem-p1',
        name: '岩鎧',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'damage_reduction', amount: 1 },
      },
    ],
  },
  {
    baseId: 'fenrir',
    name: 'フェンリル',
    stats: { hp: 10, atk: 5, def: 3, spd: 8 },
    passives: [
      {
        id: 'fenrir-p1',
        name: '疾風の祝福',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'spd_roll_bonus', amount: 2 },
      },
    ],
  },
  {
    baseId: 'elf',
    name: 'エルフ',
    stats: { hp: 10, atk: 5, def: 3, spd: 6 },
    passives: [
      {
        id: 'elf-p1',
        name: '軽やかな舞踊',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'dodge_bonus', percent: 15 },
      },
    ],
  },
  {
    baseId: 'wyvern',
    name: 'ワイバーン',
    stats: { hp: 12, atk: 6, def: 4, spd: 5 },
    passives: [
      {
        id: 'wyvern-p1',
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
        effect: { kind: 'pick_higher_buff', amount: 2 },
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
    baseId: 'vampire',
    name: 'ヴァンパイア',
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
];

export const MONSTERS_BY_ID: Record<string, MonsterBase> = Object.fromEntries(
  MONSTERS.map((m) => [m.baseId, m]),
);
