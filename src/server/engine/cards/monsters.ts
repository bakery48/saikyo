import type { MonsterBase } from '../types';

export const MONSTERS: MonsterBase[] = [
  {
    baseId: 'demon',
    name: 'デーモン',
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
    stats: { hp: 16, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'unicorn-p1',
        name: '清廉潔白',
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
    stats: { hp: 14, atk: 5, def: 5, spd: 5 },
    passives: [
      {
        id: 'slime-p1',
        name: '形なき適応',
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
        name: '時の輪廻',
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
  {
    baseId: 'berserker',
    name: 'バーサーカー',
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
    stats: { hp: 12, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'cerberus-p1',
        name: '三連の牙',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'extra_attack_chance', percent: 10 },
      },
    ],
  },
  {
    baseId: 'carbuncle',
    name: 'カーバンクル',
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
    baseId: 'knight',
    name: 'ナイト',
    stats: { hp: 14, atk: 5, def: 5, spd: 3 },
    passives: [
      {
        id: 'knight-p1',
        name: '背水の覚悟',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'low_hp_atk_bonus', amount: 4 },
      },
    ],
  },
];

export const MONSTERS_BY_ID: Record<string, MonsterBase> = Object.fromEntries(
  MONSTERS.map((m) => [m.baseId, m]),
);
