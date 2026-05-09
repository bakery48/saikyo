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
      return '次戦は全員のアクティブスキル順序を逆転';
    case 'skip_action_phase':
      return 'このアクションフェーズをスキップ';
    case 'skip_draft_phase':
      return 'このドラフトフェーズをスキップ';
    case 'extra_battle':
      return '今すぐ追加バトル → アクションフェーズへ';
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
      return `${e.stat.toUpperCase()}${e.amount >= 0 ? '+' : ''}${e.amount} (${
        e.duration === 'permanent' ? '永続' : '次戦のみ'
      })`;
    case 'stat_mod_choice': {
      const dur = e.duration === 'permanent' ? '永続' : '次戦のみ';
      if (chosenStat) {
        return `${chosenStat.toUpperCase()}+${e.amount} (${dur})`;
      }
      return `HP/ATK/DEF/SPDから1つ選んで+${e.amount} (${dur})`;
    }
    case 'recover_skill_from_grave':
      return 'スキル墓地から1枚回収';
    case 'draw_skill_top':
      return 'スキル山札から1枚追加';
    case 'discard_random_active':
      return 'アクティブスキル1枚をランダムに破棄';
    case 'gain_passive':
      return `パッシブ獲得: ${e.passive.name}`;
    case 'swap_actives':
      return '誰かのアクティブスキル2つの順序を入れ替え';
  }
}
