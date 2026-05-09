import type {
  ActiveSkill,
  PassiveEffect,
  PassiveSkill,
  PassiveTrigger,
  SkillEffect,
} from '../server/engine/types';

/** Short, human-readable description of an active skill's effect. */
export function describeActiveEffect(e: SkillEffect): string {
  switch (e.kind) {
    case 'attack':
      return `${e.useStat.toUpperCase()}×${e.mult} 攻撃`;
    case 'true_damage':
      return `DEF無視 ${e.amount} ダメージ`;
    case 'heal':
      return `HP+${e.amount} 回復`;
    case 'shield':
      return `次の被ダメ−${e.amount}`;
    case 'buff_self':
      return `自身${e.stat.toUpperCase()}+${e.amount}(${e.duration})`;
    case 'debuff_target':
      return `相手${e.stat.toUpperCase()}−${e.amount}(${e.duration})`;
    case 'next_amp':
      return `次の自分の攻撃×${e.mult}`;
    case 'nullify_next':
      return `相手の次のスキルを無効`;
  }
}

/** Trigger label for passives (e.g. "バトル開始時"). */
export function describePassiveTrigger(t: PassiveTrigger): string {
  switch (t.kind) {
    case 'first_attack':
      return '初撃時';
    case 'battle_start':
      return 'バトル開始時';
    case 'on_own_turn_start':
      return 'ターン開始時';
    case 'on_take_damage':
      return '被ダメ時';
    case 'on_deal_damage':
      return '与ダメ時';
  }
}

/** Effect label for passives, ignoring trigger. */
export function describePassiveEffect(e: PassiveEffect): string {
  switch (e.kind) {
    case 'stat_mod':
      return `${e.stat.toUpperCase()}+${e.amount}`;
    case 'first_attack_amp':
      return `初撃ダメージ×${e.amount}`;
    case 'first_attack_true':
      return `初撃がDEF無視`;
    case 'spd_roll_bonus':
      return `SPDロール+${e.amount}`;
    case 'damage_reduction':
      return `被ダメ−${e.amount}`;
    case 'turn_start_heal':
      return `HP+${e.amount} 回復`;
    case 'damage_negate_chance':
      return `${e.oneIn}分の1で被ダメ無効`;
    case 'pick_higher_buff':
      return `バフを高い方+${e.amount}`;
    case 'amp_each_active':
      return `アクティブごとに威力×${e.amount}`;
    case 'lifesteal':
      return `与えたダメージの1/${e.denominator}を回復`;
    case 'endure_fatal':
      return `1度だけHP1で耐える`;
  }
}

/** Combined "<trigger> <effect>" for a passive. */
export function describePassive(p: { trigger: PassiveTrigger; effect: PassiveEffect }): string {
  return `${describePassiveTrigger(p.trigger)} ${describePassiveEffect(p.effect)}`;
}

/** Tooltip body for an active skill (effect + tag, newline-separated). */
export function activeTooltip(a: ActiveSkill): string {
  const lines = [describeActiveEffect(a.effect)];
  if (a.nameTag) lines.push(`tag: ${a.nameTag}`);
  return lines.join('\n');
}

/** Tooltip body for a passive skill (trigger+effect + tag, newline-separated). */
export function passiveTooltip(p: PassiveSkill): string {
  const lines = [describePassive(p)];
  if (p.nameTag) lines.push(`tag: ${p.nameTag}`);
  return lines.join('\n');
}
