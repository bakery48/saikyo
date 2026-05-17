import type { MonsterBase } from '../types';
import rawOverrides from './monsters.overrides.json';

export const MONSTERS: MonsterBase[] = [
  {
    baseId: 'demon',
    name: 'デーモン',
    attackKind: 'claw',
    stats: { hp: 35, atk: 6, def: 6, spd: 2 },
    passives: [
      {
        id: 'demon-p1',
        name: '悪の目醒め',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'first_attack_damage_mult', mult: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-demon', name: '悪の研鑽', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-demon-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-demon-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-demon-3', name: '強攻撃を得る', effect: { kind: 'skill_card', cardId: 'sk-r-001' } },
    ],
  },
  {
    baseId: 'unicorn',
    name: 'ユニコーン',
    attackKind: 'strike',
    stats: { hp: 36, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'unicorn-p1',
        name: '清廉潔白',
        trigger: { kind: 'on_own_turn_start' },
        effect: { kind: 'turn_start_heal', amount: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-unicorn', name: '聖なる意志', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-unicorn-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-unicorn-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-unicorn-3', name: '癒しの風を得る', effect: { kind: 'skill_card', cardId: 'sk-r-015' } },
    ],
  },
  {
    baseId: 'golem',
    name: 'ゴーレム',
    attackKind: 'strike',
    stats: { hp: 37, atk: 5, def: 7, spd: 0 },
    passives: [
      {
        id: 'golem-p1',
        name: '岩鎧',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'damage_reduction', amount: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-golem', name: '岩盤鍛錬', effect: { kind: 'stat_mod', stat: 'def', amount: 1 } },
    boons: [
      { id: 'boon-golem-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-golem-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-golem-3', name: '岩石防御を得る', effect: { kind: 'skill_card', cardId: 'sk-r-006' } },
    ],
  },
  {
    baseId: 'fenrir',
    name: 'フェンリル',
    attackKind: 'claw',
    stats: { hp: 30, atk: 5, def: 3, spd: 8 },
    passives: [
      {
        id: 'fenrir-p1',
        name: '疾風の祝福',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'spd_roll_bonus', amount: 3 },
      },
    ],
    uniqueActionCard: { id: 'unique-fenrir', name: '疾風修行', effect: { kind: 'stat_mod', stat: 'spd', amount: 1 } },
    boons: [
      { id: 'boon-fenrir-1', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-fenrir-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-fenrir-3', name: '光速を得る', effect: { kind: 'skill_card', cardId: 'sk-r-007' } },
    ],
  },
  {
    baseId: 'fairy',
    name: 'フェアリー',
    attackKind: 'sword',
    stats: { hp: 30, atk: 5, def: 3, spd: 6 },
    passives: [
      {
        id: 'fairy-p1',
        name: '妖しい舞踊',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'dodge_bonus', percent: 20 },
      },
    ],
    uniqueActionCard: { id: 'unique-fairy', name: '軽業の稽古', effect: { kind: 'stat_mod', stat: 'spd', amount: 1 } },
    boons: [
      { id: 'boon-fairy-1', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-fairy-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-fairy-3', name: '光速を得る', effect: { kind: 'skill_card', cardId: 'sk-r-007' } },
    ],
  },
  {
    baseId: 'wyvern',
    name: 'ワイバーン',
    attackKind: 'claw',
    stats: { hp: 30, atk: 6, def: 3, spd: 7 },
    passives: [
      {
        id: 'wyvern-p1',
        name: '急襲の本能',
        trigger: { kind: 'first_attack' },
        effect: { kind: 'first_attack_true' },
      },
    ],
    uniqueActionCard: { id: 'unique-wyvern', name: '急降下訓練', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-wyvern-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-wyvern-2', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-wyvern-3', name: '影刺しを得る', effect: { kind: 'skill_card', cardId: 'sk-n-028' } },
    ],
  },
  {
    baseId: 'slime',
    name: 'スライム',
    attackKind: 'strike',
    stats: { hp: 34, atk: 5, def: 5, spd: 5 },
    passives: [
      {
        id: 'slime-p1',
        name: '形なき適応',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'pick_higher_buff_mult', mult: 1.5 },
      },
    ],
    uniqueActionCard: { id: 'unique-slime', name: '形態適応', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-slime-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-slime-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-slime-3', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
    ],
  },
  {
    baseId: 'ouroboros',
    name: 'ウロボロス',
    attackKind: 'magic',
    stats: { hp: 30, atk: 3, def: 4, spd: 6 },
    passives: [
      {
        id: 'ouroboros-p1',
        name: '時の輪廻',
        trigger: { kind: 'on_own_active_used' },
        effect: { kind: 'atk_per_active', amount: 1 },
      },
    ],
    uniqueActionCard: { id: 'unique-ouroboros', name: '輪廻の研鑽', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-ouroboros-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-ouroboros-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-ouroboros-3', name: '強攻撃を得る', effect: { kind: 'skill_card', cardId: 'sk-r-001' } },
    ],
  },
  {
    baseId: 'vampire',
    name: 'ヴァンパイア',
    attackKind: 'claw',
    stats: { hp: 30, atk: 6, def: 3, spd: 5 },
    passives: [
      {
        id: 'vampire-p1',
        name: '吸血',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'lifesteal', denominator: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-vampire', name: '吸血の研鑽', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-vampire-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-vampire-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-vampire-3', name: '強攻撃を得る', effect: { kind: 'skill_card', cardId: 'sk-r-001' } },
    ],
  },
  {
    baseId: 'phoenix',
    name: 'フェニックス',
    attackKind: 'magic',
    stats: { hp: 32, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'phoenix-p1',
        name: '不死鳥の加護',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'endure_fatal', reviveDenominator: 4 },
      },
    ],
    uniqueActionCard: { id: 'unique-phoenix', name: '不死の意志', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-phoenix-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-phoenix-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-phoenix-3', name: '癒しの風を得る', effect: { kind: 'skill_card', cardId: 'sk-r-015' } },
    ],
  },
  {
    baseId: 'berserker',
    name: 'バーサーカー',
    attackKind: 'sword',
    stats: { hp: 28, atk: 7, def: 2, spd: 5 },
    passives: [
      {
        id: 'berserker-p1',
        name: '怒りの咆哮',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'rage_atk', amount: 1 },
      },
    ],
    uniqueActionCard: { id: 'unique-berserker', name: '怒りの修行', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-berserker-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-berserker-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-berserker-3', name: '気力解放を得る', effect: { kind: 'skill_card', cardId: 'sk-r-005' } },
    ],
  },
  {
    baseId: 'wizard',
    name: 'ウィザード',
    attackKind: 'magic',
    stats: { hp: 32, atk: 3, def: 5, spd: 5 },
    passives: [
      {
        id: 'wizard-p1',
        name: '装甲呪詛',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'hex_def', amount: 1 },
      },
    ],
    uniqueActionCard: { id: 'unique-wizard', name: '呪詛の研鑽', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-wizard-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-wizard-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-wizard-3', name: '剥離を得る', effect: { kind: 'skill_card', cardId: 'sk-r-009' } },
    ],
  },
  {
    baseId: 'cerberus',
    name: 'ケルベロス',
    attackKind: 'claw',
    stats: { hp: 32, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'cerberus-p1',
        name: '連携攻撃',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'extra_attack_chance', percent: 10 },
      },
    ],
    uniqueActionCard: { id: 'unique-cerberus', name: '三頭連携', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-cerberus-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-cerberus-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-cerberus-3', name: '強攻撃を得る', effect: { kind: 'skill_card', cardId: 'sk-r-001' } },
    ],
  },
  {
    baseId: 'carbuncle',
    name: 'カーバンクル',
    attackKind: 'magic',
    stats: { hp: 34, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'carbuncle-p1',
        name: '宝玉の反射',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'counter_damage', denominator: 3 },
      },
    ],
    uniqueActionCard: { id: 'unique-carbuncle', name: '宝玉の守護', effect: { kind: 'stat_mod', stat: 'def', amount: 1 } },
    boons: [
      { id: 'boon-carbuncle-1', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-carbuncle-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-carbuncle-3', name: 'いばらの盾を得る', effect: { kind: 'skill_card', cardId: 'sk-r-004' } },
    ],
  },
  {
    baseId: 'scarab',
    name: 'スカラベ',
    attackKind: 'magic',
    stats: { hp: 34, atk: 4, def: 5, spd: 4 },
    passives: [
      {
        id: 'scarab-p1',
        name: '聖甲虫の加護',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'absorb_first_hit' },
      },
    ],
    uniqueActionCard: { id: 'unique-scarab', name: '聖甲虫の鍛錬', effect: { kind: 'stat_mod', stat: 'def', amount: 1 } },
    boons: [
      { id: 'boon-scarab-1', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-scarab-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-scarab-3', name: '中盾を得る', effect: { kind: 'skill_card', cardId: 'sk-r-016' } },
    ],
  },
  {
    baseId: 'dragon',
    name: 'ドラゴン',
    attackKind: 'claw',
    stats: { hp: 33, atk: 5, def: 2, spd: 6 },
    passives: [
      {
        id: 'dragon-p1',
        name: '紅龍の鱗',
        trigger: { kind: 'on_take_damage' },
        effect: { kind: 'mid_damage_immune', min: 4, max: 9 },
      },
    ],
    uniqueActionCard: { id: 'unique-dragon', name: '龍の生命力', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-dragon-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-dragon-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-dragon-3', name: '要塞を得る', effect: { kind: 'skill_card', cardId: 'sk-r-017' } },
    ],
  },
  {
    baseId: 'goblin',
    name: 'ゴブリン',
    attackKind: 'strike',
    stats: { hp: 32, atk: 4, def: 3, spd: 6 },
    passives: [
      {
        id: 'goblin-p1',
        name: '群がる刃',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'low_damage_bonus', threshold: 2, bonus: 3 },
      },
    ],
    uniqueActionCard: { id: 'unique-goblin', name: '群れの生命力', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-goblin-1', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-goblin-2', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-goblin-3', name: '速攻を得る', effect: { kind: 'skill_card', cardId: 'sk-r-018' } },
    ],
  },
  {
    baseId: 'griffon',
    name: 'グリフォン',
    attackKind: 'claw',
    stats: { hp: 33, atk: 3, def: 4, spd: 6 },
    passives: [
      {
        id: 'griffon-p1',
        name: '天空の覇者',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'pierce_all_shields' },
      },
    ],
    uniqueActionCard: { id: 'unique-griffon', name: '天空の駆け抜け', effect: { kind: 'stat_mod', stat: 'spd', amount: 1 } },
    boons: [
      { id: 'boon-griffon-1', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-griffon-2', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-griffon-3', name: '強攻撃を得る', effect: { kind: 'skill_card', cardId: 'sk-r-001' } },
    ],
  },
  {
    baseId: 'shaman',
    name: 'シャーマン',
    attackKind: 'magic',
    stats: { hp: 31, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'shaman-p1',
        name: '死霊の加護',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'spd_roll_bonus', amount: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-shaman', name: '呪い付与', effect: { kind: 'curse_player', amount: 2 } },
    boons: [
      { id: 'boon-shaman-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-shaman-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-shaman-3', name: '強攻撃を得る', effect: { kind: 'skill_card', cardId: 'sk-r-001' } },
    ],
  },
  {
    baseId: 'druid',
    name: 'ドルイド',
    attackKind: 'magic',
    stats: { hp: 32, atk: 3, def: 5, spd: 4 },
    passives: [
      {
        id: 'druid-p1',
        name: '叡智の結晶',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'passive_count_atk_buff', perPassive: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-druid', name: '叡智の探求', effect: { kind: 'draw_passive_top', maxDraws: 10 } },
    boons: [
      { id: 'boon-druid-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-druid-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-druid-3', name: '鋼の体を得る', effect: { kind: 'skill_card', cardId: 'sk-rp-043' } },
    ],
  },
  {
    baseId: 'bug',
    name: 'バグ',
    attackKind: 'magic',
    hidden: true,
    stats: { hp: 30, atk: 5, def: 5, spd: 5 },
    passives: [
      {
        id: 'bug-p1',
        name: '崩壊する身体',
        trigger: { kind: 'on_own_active_used' },
        effect: { kind: 'self_decay', hp: 3, atk: 2, def: 2, spd: 2 },
      },
    ],
    uniqueActionCard: { id: 'unique-bug', name: '崩壊への抵抗', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-bug-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-bug-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-bug-3', name: '癒しの風を得る', effect: { kind: 'skill_card', cardId: 'sk-r-015' } },
    ],
  },
  {
    baseId: 'knight',
    name: 'ナイト',
    attackKind: 'sword',
    stats: { hp: 34, atk: 5, def: 5, spd: 3 },
    passives: [
      {
        id: 'knight-p1',
        name: '背水の覚悟',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'low_hp_atk_mult', mult: 2, thresholdFraction: 0.5 },
      },
    ],
    uniqueActionCard: { id: 'unique-knight', name: '背水の鍛錬', effect: { kind: 'stat_mod', stat: 'def', amount: 1 } },
    boons: [
      { id: 'boon-knight-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-knight-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-knight-3', name: '中盾を得る', effect: { kind: 'skill_card', cardId: 'sk-r-016' } },
    ],
  },
  {
    baseId: 'ghost',
    name: 'ゴースト',
    attackKind: 'strike',
    stats: { hp: 31, atk: 4, def: 8, spd: 3 },
    passives: [
      {
        id: 'ghost-p1',
        name: '残留思念',
        trigger: { kind: 'on_last_active_used' },
        effect: { kind: 'grant_ghost_shield_on_last_active', amount: 99 },
      },
    ],
    uniqueActionCard: { id: 'unique-ghost', name: '霊体の生命力', effect: { kind: 'stat_mod', stat: 'hp', amount: 1 } },
    boons: [
      { id: 'boon-ghost-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-ghost-2', name: 'DEF強化', effect: { kind: 'stat_up', stat: 'def', amount: 2 } },
      { id: 'boon-ghost-3', name: '中盾を得る', effect: { kind: 'skill_card', cardId: 'sk-r-016' } },
    ],
  },
  {
    baseId: 'okuninushi',
    name: 'オオクニヌシ',
    attackKind: 'strike',
    stats: { hp: 33, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'okuninushi-p1',
        name: '迸る稲妻',
        trigger: { kind: 'on_deal_damage' },
        effect: { kind: 'paralyze_on_active', percent: 30 },
      },
    ],
    uniqueActionCard: { id: 'unique-okuninushi', name: '雷神の加護', effect: { kind: 'stat_mod', stat: 'spd', amount: 2 } },
    boons: [
      { id: 'boon-okuninushi-1', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-okuninushi-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-okuninushi-3', name: '電撃を得る', effect: { kind: 'skill_card', cardId: 'sk-n-030' } },
    ],
  },
  {
    baseId: 'joker',
    name: 'ジョーカー',
    attackKind: 'strike',
    stats: { hp: 32, atk: 5, def: 4, spd: 5 },
    passives: [
      {
        id: 'joker-p1',
        name: '気まぐれな運命',
        trigger: { kind: 'battle_start' },
        effect: { kind: 'spd_roll_bonus', amount: 1 },
      },
    ],
    uniqueActionCard: { id: 'unique-joker', name: '気まぐれな強化', effect: { kind: 'random_stat_up', amount: 4 } },
    boons: [
      { id: 'boon-joker-1', name: 'HP強化', effect: { kind: 'stat_up', stat: 'hp', amount: 2 } },
      { id: 'boon-joker-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-joker-3', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
    ],
  },
  {
    baseId: 'incubus',
    name: 'インキュバス',
    attackKind: 'magic',
    stats: { hp: 30, atk: 5, def: 2, spd: 7 },
    passives: [
      {
        id: 'incubus-p1',
        name: '夢魔の囁き',
        trigger: { kind: 'on_own_active_used' },
        effect: { kind: 'debuff_amp', amount: 1 },
      },
    ],
    uniqueActionCard: { id: 'unique-incubus', name: '夢魔の誘惑', effect: { kind: 'stat_mod', stat: 'atk', amount: 1 } },
    boons: [
      { id: 'boon-incubus-1', name: 'SPD強化', effect: { kind: 'stat_up', stat: 'spd', amount: 2 } },
      { id: 'boon-incubus-2', name: 'ATK強化', effect: { kind: 'stat_up', stat: 'atk', amount: 2 } },
      { id: 'boon-incubus-3', name: '影刺しを得る', effect: { kind: 'skill_card', cardId: 'sk-n-028' } },
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
