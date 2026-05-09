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
      return '自分がアクティブスキルを使う直前';
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
      return `バトルでの最初の自分の攻撃はDEF無視`;
    case 'first_attack_def_div':
      return `バトルでの最初の自分の攻撃は相手のDEFを1/${e.denominator}（切り捨て）にする`;
    case 'first_attack_damage_mult':
      return `バトルでの最初の自分の攻撃はダメージ${e.mult}倍`;
    case 'spd_roll_bonus':
      return `先攻後攻判定のダイス出目に+${e.amount}`;
    case 'damage_reduction':
      return `被ダメ−${e.amount}`;
    case 'turn_start_heal':
      return `HP+${e.amount} 回復`;
    case 'damage_negate_chance':
      return `${e.oneIn}分の1で被ダメ無効`;
    case 'dodge_bonus':
      return `回避率+${e.percent}%`;
    case 'pick_higher_buff':
      return `ATKとDEFの高い方に+${e.amount}`;
    case 'atk_per_active':
      return e.every && e.every > 1
        ? `${e.every}回攻撃ごとにATK+${e.amount}`
        : `攻撃ごとにATK+${e.amount}`;
    case 'lifesteal':
      return `与えたダメージの1/${e.denominator}を回復`;
    case 'rage_atk':
      return `被ダメ時にATK+${e.amount}（バトル中累積）`;
    case 'hex_def':
      return `与ダメ時に相手のDEF-${e.amount}（バトル中累積）`;
    case 'extra_attack_chance':
      return `攻撃時${e.percent}%で2回発動`;
    case 'counter_damage':
      return `被ダメの1/${e.denominator}（切り捨て）を相手に反射`;
    case 'low_hp_atk_bonus':
      return `HPが半分以下のときATK+${e.amount}`;
    case 'endure_fatal':
      return e.reviveDenominator
        ? `1度だけ最大HPの1/${e.reviveDenominator}（切り捨て）で耐える`
        : `1度だけHP1で耐える`;
  }
}

/** Combined "<trigger> <effect>" for a passive. */
export function describePassive(p: { trigger: PassiveTrigger; effect: PassiveEffect }): string {
  // Some effect descriptions already encode their own timing — skip the
  // trigger prefix so the tooltip doesn't read "初撃時 バトルでの最初の…".
  if (
    p.effect.kind === 'first_attack_true' ||
    p.effect.kind === 'first_attack_amp' ||
    p.effect.kind === 'first_attack_def_div' ||
    p.effect.kind === 'first_attack_damage_mult'
  ) {
    return describePassiveEffect(p.effect);
  }
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
