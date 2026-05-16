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
  const e = card.effect;
  switch (e.kind) {
    case 'stat_mod':
      return `${e.stat.toUpperCase()}${e.amount >= 0 ? '+' : ''}${e.amount}`;
    case 'stat_mod_choice': {
      if (chosenStat) {
        return `${chosenStat.toUpperCase()}+${e.amount}`;
      }
      return `HP/ATK/DEF/SPDから1つ選んで+${e.amount}`;
    }
    case 'recover_skill_from_grave':
      return 'スキル墓地から1枚回収';
    case 'draw_skill_top':
      return 'スキル山札から1枚追加';
    case 'discard_random_active':
      return 'スロット1つをランダムに破棄';
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
  }
}
