import type { ActionCard, EventCard, EventTarget, StatKey } from '../server/engine/types';

/** Human-readable target label for an event card. */
export function describeEventTarget(target: EventTarget): string {
  switch (target) {
    case 'all':
      return '全員';
    case 'random':
      return 'ランダム1人';
    case 'lowestHp':
      return 'HP最少';
    case 'highestAtk':
      return 'ATK最高';
  }
}

/** Short description of an event card's effect. */
export function describeEventEffect(card: EventCard): string {
  if (card.description) return card.description;
  const e = card.effect;
  switch (e.kind) {
    case 'stat_mod':
      return `${e.stat.toUpperCase()}${e.amount >= 0 ? '+' : ''}${e.amount}`;
    case 'swap_stat':
      return `${e.stat.toUpperCase()}を相手と入れ替え`;
    case 'heal':
      return `HP+${e.amount}`;
    case 'damage':
      return `HP-${e.amount}`;
    case 'add_skill_top':
      return `スキル山札から1枚追加`;
    case 'reverse_actives_next_battle':
      return '次戦は全員のスロット順を逆転';
    case 'skip_action_phase':
      return 'このアクションフェーズをスキップ';
    case 'extra_battle':
      return '今すぐ追加バトル → アクションフェーズへ';
    case 'swap_atk_def':
      return 'ATKとDEFが入れ替わる';
    case 'shuffle_actives':
      return 'アクティブスキルの順序がシャッフルされる';
    case 'average_hp':
      return '全員のHPが平均値（切り上げ）に揃う';
    case 'discard_action_card':
      return '手札からランダムに1枚捨てる';
    case 'draw_action_card':
      return 'アクションカードを1枚引く';
    case 'all_stats_mod':
      return `全ステータス${e.amount > 0 ? '+' : ''}${e.amount}`;
    case 'set_stat':
      return `${e.stat.toUpperCase()}が${e.value}になる`;
    case 'pay_hp_draw_skill':
      return `HP-${e.hpCost}してスキルカードを1枚獲得`;
    case 'steal_skill':
      return 'スキルカード1枚が他のプレイヤーへ渡る';
  }
}

/**
 * Short description of an action card's effect. For stat_mod_choice cards,
 * pass `chosenStat` to render the picked stat in the summary.
 */
export function describeActionEffect(card: ActionCard, chosenStat?: StatKey): string {
  if (card.description) return card.description;
  const e = card.effect;
  switch (e.kind) {
    case 'stat_mod':
      return `${e.stat.toUpperCase()}${e.amount >= 0 ? '+' : ''}${e.amount}`;
    case 'stat_mod_choice': {
      if (chosenStat) {
        return `${chosenStat.toUpperCase()}+${e.amount}`;
      }
      const labels = (e.stats ?? ['hp', 'atk', 'def', 'spd']).map((s) => s.toUpperCase()).join('/');
      return `${labels}から1つ選んで+${e.amount}`;
    }
    case 'recover_skill_from_grave':
      return 'スキル墓地から1枚回収';
    case 'draw_skill_top':
      return 'スキル山札から1枚追加';
    case 'draw_skill_top_with_stat_loss':
      return `スキル山札から1枚追加（ATK/DEF/SPDのどれかランダムで-${e.amount}）`;
    case 'discard_random_active':
      return 'スロット1つをランダムに破棄';
    case 'discard_actives_gain_stat': {
      const labels = e.stats.map((s) => s.toUpperCase()).join('/');
      return `スロットをランダムに${e.discardCount}つ破棄 → ${labels}から選んで+${e.amount}`;
    }
    case 'cleanse_sin':
      return '自分の罪カードを1枚ランダムに破棄';
    case 'gain_passive':
      return `パッシブ獲得: ${e.passive.name}`;
    case 'swap_actives':
      return '誰かのスロット2つの順序を入れ替え';
    case 'become_bug':
      return '自分のモンスターに変化が起こる';
    case 'random_stat_up':
      return `HP/ATK/DEF/SPDのいずれか+${e.amount}（ランダム）`;
    case 'curse_player':
      return `対象のATK/DEFをそれぞれ-${e.amount}（永続）`;
    case 'draw_passive_top':
      return 'スキルデッキからパッシブカードを1枚獲得';
    case 'steal_stat':
      return `最高${e.stat.toUpperCase()}の相手から${e.stat.toUpperCase()}-${e.amount}を奪う`;
    case 'copy_stat_from_leader': {
      const pen = e.penalty ?? 0;
      const suffix = pen > 0 ? `-${pen}` : '';
      return `自分の${e.stat.toUpperCase()}を全員の最高値${suffix}に揃える`;
    }
    case 'trade_stat':
      return `${e.from.toUpperCase()}-${e.fromAmount}して${e.to.toUpperCase()}+${e.toAmount}`;
    case 'slot_top_skill':
      return 'スキルデッキ先頭を直接スロットに装備（空きなければストックへ）';
    case 'upgrade_skill':
      return 'ストックのカードをランダムに1枚ランクアップ（N→R→SR→SSR）';
    case 'copy_skill_from_player':
      return 'ランダムな相手のストックからスキルカードを1枚コピー';
    case 'hp_to_atk':
      return `現在HPの${Math.round(e.fraction * 100)}%分ATKを永続強化`;
    case 'all_stats_mod':
      return `全ステータス${e.amount > 0 ? '+' : ''}${e.amount}`;
    case 'swap_all_stats':
      return '最高ATKの相手と全ステータスを交換';
    case 'average_stat_with_random':
      return `ランダムな相手と${e.stat.toUpperCase()}を平均化（切り上げ）`;
    case 'mutate_skill':
      return '盛っているスキル1枚を同レアリティのランダムなスキルに変異';
    case 'replay_from_grave':
      return 'アクション墓地から1枚選んで同じ効果を即時適用';
    case 'round_scaled_stat_mod':
      return `${e.stat.toUpperCase()}+（現在ラウンド×${e.perRound}）`;
  }
}
