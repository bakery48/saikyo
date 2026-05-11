import type {
  ActiveSkill,
  AttackKind,
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
    case 'shield_break_attack':
      return `盾なし: ${e.useStat.toUpperCase()}×${e.multNoShield} / 盾あり: 全シールド破壊＋${e.useStat.toUpperCase()}×${e.multShield}`;
    case 'grant_target_shield':
      return `相手にシールド+${e.amount}（罪）`;
    case 'buff_target':
      return `相手${e.stat.toUpperCase()}+${e.amount}（${e.duration === 'battle' ? 'バトル中' : '次の1回'}・罪）`;
    case 'self_damage':
      return `自分にHP−${e.amount}（罪）`;
    case 'self_damage_max_fraction':
      return `自分に最大HP×${Math.round(e.fraction * 100)}%のダメージ（罪）`;
    case 'heal_target':
      return `相手のHP+${e.amount}（罪）`;
    case 'heal_target_max_fraction':
      return `相手のHPを最大HP×${Math.round(e.fraction * 100)}%回復（罪）`;
    case 'true_damage':
      return `DEF無視 ${e.amount} ダメージ`;
    case 'target_stat_damage':
      return `相手${e.stat.toUpperCase()}×${e.mult} のDEF無視ダメージ`;
    case 'stat_diff_damage':
      return `(相手${e.stat.toUpperCase()}−自分${e.stat.toUpperCase()})×${e.mult} のDEF無視ダメージ`;
    case 'target_higher_stat_attack':
      return `相手のATK/DEFの高い方×${e.mult} のDEF無視ダメージ`;
    case 'conditional_attack_if_target_higher':
      return `相手${e.stat.toUpperCase()}が自分より高ければ${e.useStat.toUpperCase()}×${e.multIf}、そうでなければ${e.useStat.toUpperCase()}×${e.multElse} 攻撃`;
    case 'heal':
      return `HP+${e.amount} 回復`;
    case 'shield':
      return `シールド${e.amount}（累計で吸収、枯渇で解除）`;
    case 'reflect_shield':
      return `棘シールド${e.amount}（被ダメを吸収＆反射、累計${e.amount}で解除）`;
    case 'threshold_shield':
      return `不動盾（${e.threshold - 1}以下の攻撃を無効化、${e.threshold}以上で盾が砕ける）`;
    case 'pay_hp_threshold_shield':
      return `最大HP${e.hpCostFraction * 100}%を消費、不動盾（${e.threshold - 1}以下の攻撃を無効化、${e.threshold}以上で盾が砕ける）`;
    case 'buff_self':
      return `自身${e.stat.toUpperCase()}${e.amount >= 0 ? '+' : ''}${e.amount}（${e.duration === 'battle' ? 'バトル中' : '次の1回'}）`;
    case 'debuff_target':
      return `相手${e.stat.toUpperCase()}−${e.amount}（${e.duration === 'battle' ? 'バトル中' : '次の1回'}）`;
    case 'next_amp':
      return `次の自分の攻撃×${e.mult}`;
    case 'nullify_next':
      return `相手の次のスキルを無効`;
    case 'self_nullify_next':
      return `自分の次のスロットを無効化（罪）`;
    case 'pause_opponent':
      return `相手の次のターンをスキップ`;
    case 'shuffle_opponent_actives':
      return `相手の残りスロット順をランダムに入替え`;
    case 'next_multi_attack':
      return `次の攻撃を${1 + e.extraCount}回行う（攻撃以外なら不発・自分に${e.failurePenalty}ダメージ）`;
    case 'pay_hp_shield':
      return `自HP-${e.hpCost} → シールド+${e.shieldAmount}`;
    case 'pay_hp_debuff_all':
      return `自HP-${e.hpCost} → 相手のATK/DEF/SPD-${e.amount}（バトル中）`;
    case 'gamble_true_damage':
      return `${e.percent}%で相手に${e.amount}ダメージ、外れたら自分に${e.amount}ダメージ`;
    case 'buff_self_all':
      return `自身のATK/DEF/SPD+${e.amount}（${e.duration === 'battle' ? 'バトル中' : '次の1回'}）`;
    case 'multi_hit_attack':
      return `${e.useStat.toUpperCase()}×${e.mult} 攻撃を${e.hitCount}回`;
    case 'heal_max_fraction':
      return e.denominator === 1
        ? `HP全回復`
        : `最大HPの1/${e.denominator}を回復`;
    case 'rewind_skill':
      return `スロットを${e.rewindBy}つ戻す（廃棄・自分に${e.selfDamage}ダメージ）`;
    case 'deja_vu_attack':
      return `${e.useStat.toUpperCase()}+N で攻撃（N=このカードのバトル中の使用回数、mult ${e.mult}）`;
    case 'drain_hp':
      return `相手から${e.amount}HPを奪って回復`;
    case 'steal_stat':
      return `相手の${e.stat.toUpperCase()}を${e.amount}奪取（自分に加算）`;
    case 'debuff_all':
      return `相手のATK/DEF/SPD各−${e.amount}（バトル中）`;
    case 'dispel':
      return `相手の能力上昇を全て除去`;
    case 'shield_bash':
      return `現在のシールド値をDEF無視ダメージとして放出`;
    case 'swap_hp':
      return `相手とHPを交換`;
    case 'sacrifice_attack':
      return `現在HPの${Math.round(e.hpRatio * 100)}%を消費して同値の真ダメージ`;
    case 'execute':
      return `相手のHPが${e.threshold}以下なら即死`;
    case 'percent_max_hp_true':
      return `相手の最大HPの${e.percent}%をDEF無視ダメージ`;
    case 'cleanse_self':
      return `自分にかかっている能力低下を全て解除`;
    case 'swap_atk_def':
      return `自身のATKとDEFを入れ替え（バトル中）`;
    case 'hp_to_atk':
      return `失ったHPの1/${e.divisor}だけATK上昇（バトル中）`;
    case 'share_damage_next':
      return `次に攻撃で受けたダメージの${e.percent}%を相手に反射`;
    case 'break_shield':
      return `相手のシールドを除去`;
    case 'reckless_attack':
      return `${e.useStat.toUpperCase()}×${e.mult} 攻撃 → 次のスロットをスキップ`;
    case 'mimic_last':
      return `直前の相手の行動と同じ効果（未行動なら不発）`;
    case 'def_attack':
      return e.flat > 0 ? `DEF+${e.flat} で攻撃` : `DEF で攻撃`;
    case 'swat_attack':
      return `${e.useStat.toUpperCase()}×${e.mult} 攻撃（回避時は相手SPD分のDEF無視ダメージ）`;
    case 'coup_de_grace':
      return `${e.threshold}スロット目以降の発動で${e.amount}ダメージ`;
    case 'pin_attack': {
      const flatStr = e.flat === 0 ? '' : e.flat > 0 ? `+${e.flat}` : `${e.flat}`;
      return `${e.useStat.toUpperCase()}×${e.mult}${flatStr} 攻撃（必中・以降相手は回避不可）`;
    }
    case 'risky_attack':
      return `${e.useStat.toUpperCase()}×${e.mult} 攻撃（${e.missPercent}%で回避される）`;
    case 'counter_strike':
      return `直前に受けたダメージ×${e.mult}で攻撃`;
    case 'attack_then_dispel': {
      const flatStr = e.flat === 0 ? '' : e.flat > 0 ? `+${e.flat}` : `${e.flat}`;
      return `${e.useStat.toUpperCase()}×${e.mult}${flatStr} 攻撃 → 相手の能力上昇を全解除`;
    }
    case 'attack_then_cleanse': {
      const flatStr = e.flat === 0 ? '' : e.flat > 0 ? `+${e.flat}` : `${e.flat}`;
      return `${e.useStat.toUpperCase()}×${e.mult}${flatStr} 攻撃 → 自分の能力低下を全解除`;
    }
    case 'fixed_damage_attack':
      return `${e.amount}で攻撃`;
    case 'append_struggle':
      return e.target === 'self'
        ? `自分の末尾のスロットに「悪あがき（1で攻撃）」を${e.count}スロット追加`
        : `相手の末尾のスロットに「悪あがき（1で攻撃）」を${e.count}スロット追加`;
    case 'force_amp':
      return `次のスロットのダメージを×${e.mult}、軽減・上限を貫通`;
    case 'spd_diff_multi_attack': {
      const flatStr = e.flatAtkMod === 0 ? '' : e.flatAtkMod > 0 ? `+${e.flatAtkMod}` : `${e.flatAtkMod}`;
      return `${e.useStat.toUpperCase()}${flatStr} で攻撃を「相手SPD−自分SPD」回（最低1回）連続発動`;
    }
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
      return '自分がスロットを使う直前';
    case 'on_take_damage':
      return '被ダメ時';
    case 'on_deal_damage':
      return '与ダメ時';
    case 'on_own_active_used':
      return '自分がスロットを発動した後';
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
    case 'self_decay': {
      const parts: string[] = [];
      if (e.hp > 0) parts.push(`HP-${e.hp}`);
      if (e.atk > 0) parts.push(`ATK-${e.atk}`);
      if (e.def > 0) parts.push(`DEF-${e.def}`);
      if (e.spd > 0) parts.push(`SPD-${e.spd}`);
      return parts.join('・');
    }
    case 'reverse_actives_both':
      return `両者のスロット順が逆になる`;
    case 'low_hp_damage_reduction':
      return `HPが半分以下のとき被ダメ-${e.amount}`;
    case 'crit_chance':
      return `攻撃時${e.percent}%でダメージ×${e.mult}`;
    case 'absorb_first_hit':
      return `1度だけ被ダメージを完全無効`;
    case 'equalize_spd':
      return `戦闘開始時に両者のSPDを平均値に揃える`;
    case 'low_damage_bonus':
      return `攻撃で${e.threshold}以下のダメージを与えたとき追加${e.bonus}ダメージ`;
    case 'mid_damage_immune':
      return `${e.min}〜${e.max}のダメージを無効化`;
    case 'damage_cap':
      return `1回に受けるダメージは最大${e.maxPerHit}まで`;
    case 'bonus_vs_low_hp':
      return `相手がHP半分以下のとき与ダメ+${e.amount}（DEF無視）`;
    case 'paralyze_chance':
      return `攻撃時${e.percent}%で相手の次のターンをスキップ`;
    case 'first_received_damage_div':
      return e.denominator === 2
        ? `バトル最初の被ダメージを1/2（切り捨て）にする`
        : `バトル最初の被ダメージを1/${e.denominator}（切り捨て）にする`;
    case 'decay_atk_per_active':
      return `スロット発動後にATK-${e.amount}（バトル中累積）`;
    case 'shield_on_active':
      return `スロット発動後にシールド+${e.amount}`;
    case 'heal_on_active':
      return `スロット発動後にHP+${e.amount}回復`;
    case 'tail_fury':
      return `残りスロット${e.threshold}以下のとき与ダメ+${e.amount}`;
    case 'slow_burn':
      return `自分のターン開始時に相手HP-${e.amount}（DEF無視）`;
    case 'revenge_burst':
      return `初めてHP半分以下になったとき相手に${e.amount}DEF無視ダメージ`;
    case 'dodge_counter':
      return `攻撃を回避したとき相手に${e.amount}DEF無視ダメージ`;
    case 'shield_thorns':
      return `シールドのある状態で被ダメ時、相手に${e.amount}DEF無視ダメージ`;
    case 'opportunist':
      return `相手に能力低下があるとき与ダメ+${e.amount}（DEF無視）`;
    case 'mirror_stats':
      return `バトル開始時に相手のATK/DEF/SPDの増減を自分にコピー`;
    case 'stat_swap_battle_start':
      return `バトル開始時に自分のATKとDEFを入れ替え`;
    case 'regen_shield':
      return `自分のターン開始時にシールドを${e.amount}まで補充`;
    case 'damage_to_shield':
      return `被ダメ時、ダメージの${e.percent}%をシールドに変換`;
    case 'second_wind':
      return `初撃が当たった後にHP+${e.amount}回復`;
    case 'swap_atk_def_after_first_attack':
      return `初撃後にATKとDEFを入れ替え（バトル中）`;
    case 'first_strike_steal_atk':
      return `初撃時に相手のATKを${e.amount}奪取（バトル中）`;
    case 'odd_turn_atk_bonus':
      return `奇数回目の自分の攻撃で与ダメ+${e.amount}`;
    case 'chain_damage_bonus':
      return `攻撃するたびに与ダメ+${e.amount}（累積）`;
    case 'growth_heal':
      return `自分のターン開始時に発動回数×${e.amount}HP回復`;
    case 'predator_buff':
      return `相手HPが自分より低いとき与ダメ+${e.amount}`;
    case 'opp_crit_block':
      return `相手のクリティカルを無効化`;
    case 'slow_starter':
      return `${e.breakpoint}回目までは与ダメ-${e.malus}、それ以降は与ダメ+${e.bonus}`;
    case 'double_shield':
      return `シールドの獲得量が2倍`;
    case 'selective_immune':
      return `${attackKindLabel(e.attackKind)}属性の被ダメを完全無効化`;
    case 'attack_kind_resist':
      return `${attackKindLabel(e.attackKind)}属性の被ダメ-${e.amount}`;
    case 'last_breath':
      return `戦闘不能になる際に相手に${e.amount}DEF無視ダメージ`;
    case 'immortal_first_phase':
      return `自分のスロット使用回数${e.until}回未満まで被ダメ無効`;
    case 'rebirth':
      return `1度だけ戦闘不能時にHP全回復`;
    case 'chronos':
      return `バトル開始時にATK/DEF/SPD+${e.allBonus}、自分のターン開始時にHP-${e.hpDrain}`;
    case 'final_form':
      return `最後の自分の攻撃で与ダメ+${e.amount}`;
    case 'absolute_zero':
      return `バトル開始時、相手は回避不可・自分の攻撃はDEF無視。代わりに自分のSPDを0に固定、ATK-2`;
  }
}

function attackKindLabel(k: Exclude<AttackKind, 'passthrough'>): string {
  switch (k) {
    case 'strike': return '打撃';
    case 'sword':  return '剣';
    case 'claw':   return '爪';
    case 'magic':  return '無属性魔法';
    case 'fire':   return '炎魔法';
    case 'water':  return '水魔法';
    case 'ice':    return '氷魔法';
    case 'wind':   return '風魔法';
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
    p.effect.kind === 'first_attack_damage_mult' ||
    p.effect.kind === 'reverse_actives_both' ||
    p.effect.kind === 'low_hp_damage_reduction' ||
    p.effect.kind === 'crit_chance' ||
    p.effect.kind === 'equalize_spd' ||
    p.effect.kind === 'first_received_damage_div' ||
    p.effect.kind === 'mirror_stats' ||
    p.effect.kind === 'stat_swap_battle_start' ||
    p.effect.kind === 'damage_to_shield' ||
    p.effect.kind === 'shield_thorns' ||
    p.effect.kind === 'dodge_counter' ||
    p.effect.kind === 'revenge_burst' ||
    p.effect.kind === 'last_breath' ||
    p.effect.kind === 'rebirth' ||
    p.effect.kind === 'immortal_first_phase' ||
    p.effect.kind === 'chronos' ||
    p.effect.kind === 'final_form' ||
    p.effect.kind === 'tail_fury' ||
    p.effect.kind === 'slow_burn' ||
    p.effect.kind === 'mid_damage_immune' ||
    p.effect.kind === 'predator_buff' ||
    p.effect.kind === 'opp_crit_block' ||
    p.effect.kind === 'slow_starter' ||
    p.effect.kind === 'double_shield' ||
    p.effect.kind === 'selective_immune' ||
    p.effect.kind === 'attack_kind_resist' ||
    p.effect.kind === 'odd_turn_atk_bonus' ||
    p.effect.kind === 'chain_damage_bonus' ||
    p.effect.kind === 'second_wind' ||
    p.effect.kind === 'swap_atk_def_after_first_attack' ||
    p.effect.kind === 'first_strike_steal_atk' ||
    p.effect.kind === 'regen_shield' ||
    p.effect.kind === 'growth_heal'
  ) {
    return describePassiveEffect(p.effect);
  }
  return `${describePassiveTrigger(p.trigger)} ${describePassiveEffect(p.effect)}`;
}

/**
 * Return the description text for a SkillCard.
 * Uses `card.description` if manually set; otherwise auto-generates from the effect.
 */
export function describeSkillCard(c: { active?: { effect: SkillEffect }; passive?: { trigger: PassiveTrigger; effect: PassiveEffect }; description?: string; tag?: string }): string {
  if (c.description) return c.description;
  if (c.active) {
    const base = describeActiveEffect(c.active.effect);
    if (c.tag === 'sin') return `${base} ／ 【罪】罪の数でバトル開始時にATK自動強化`;
    return base;
  }
  if (c.passive) return `パッシブ：${describePassive(c.passive)}`;
  return '';
}

export type EffectCategory = '攻撃' | 'バフ' | 'デバフ' | '回復/防御' | '罪' | 'その他';

/** Derive the broad visual category of an active skill effect. */
export function effectCategory(e: SkillEffect): EffectCategory {
  switch (e.kind) {
    case 'attack':
    case 'shield_break_attack':
    case 'true_damage':
    case 'target_stat_damage':
    case 'stat_diff_damage':
    case 'target_higher_stat_attack':
    case 'conditional_attack_if_target_higher':
    case 'multi_hit_attack':
    case 'deja_vu_attack':
    case 'fixed_damage_attack':
    case 'gamble_true_damage':
    case 'drain_hp':
    case 'sacrifice_attack':
    case 'execute':
    case 'percent_max_hp_true':
    case 'coup_de_grace':
    case 'shield_bash':
    case 'counter_strike':
    case 'risky_attack':
    case 'swat_attack':
    case 'def_attack':
    case 'pin_attack':
    case 'reckless_attack':
    case 'spd_diff_multi_attack':
      return '攻撃';
    case 'buff_self':
    case 'buff_self_all':
    case 'hp_to_atk':
    case 'swap_atk_def':
    case 'cleanse_self':
    case 'next_amp':
    case 'force_amp':
    case 'next_multi_attack':
    case 'append_struggle':
    case 'attack_then_cleanse':
      return 'バフ';
    case 'debuff_target':
    case 'debuff_all':
    case 'dispel':
    case 'steal_stat':
    case 'pay_hp_debuff_all':
    case 'share_damage_next':
    case 'nullify_next':
    case 'attack_then_dispel':
      return 'デバフ';
    case 'heal':
    case 'heal_max_fraction':
    case 'shield':
    case 'reflect_shield':
    case 'threshold_shield':
    case 'pay_hp_threshold_shield':
    case 'pay_hp_shield':
    case 'break_shield':
      return '回復/防御';
    case 'grant_target_shield':
    case 'buff_target':
    case 'self_damage':
    case 'self_damage_max_fraction':
    case 'heal_target':
    case 'heal_target_max_fraction':
    case 'self_nullify_next':
      return '罪';
    default:
      return 'その他';
  }
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
