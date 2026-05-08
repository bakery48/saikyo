import type { Champion, GameState, TournamentMatch, TournamentState } from '../types';
import { runBattle } from '../battle';
import { shuffle } from '../deck';
import { snapshotMonsterForBattle } from './battle';
import { getPlayer, makeRng, saveRng } from '../state';

/**
 * Run a single-elimination tournament with all players that have a monster.
 * Player count rounds up to a bracket size with byes for missing slots.
 *
 * On completion, sets state.champion and state.phase = 'finished'.
 */
export function runTournament(state: GameState): void {
  if (state.phase !== 'tournament') throw new Error('not in tournament phase');
  const rng = makeRng(state);
  const competitors = shuffle(
    state.players.filter((p) => p.monster).map((p) => p.id),
    rng,
  );
  saveRng(state, rng);

  // Pad to a power of two with bye sentinels.
  let size = 1;
  while (size < competitors.length) size *= 2;
  while (competitors.length < size) competitors.push('__bye__');

  const tournament: TournamentState = {
    bracket: [],
    currentMatchIdx: 0,
    champion: null,
  };
  state.tournament = tournament;

  const totalRounds = Math.log2(size);
  let active = competitors.slice();
  for (let roundIdx = 1; roundIdx <= totalRounds; roundIdx++) {
    const next: string[] = [];
    for (let i = 0; i < active.length; i += 2) {
      const aId = active[i]!;
      const bId = active[i + 1]!;
      const winner = runMatch(state, aId, bId, roundIdx, tournament);
      next.push(winner);
    }
    active = next;
  }
  const championId = active[0]!;
  if (championId === '__bye__') {
    state.phase = 'finished';
    return;
  }
  tournament.champion = championId;
  const player = getPlayer(state, championId);
  if (player.monster) {
    const champ: Champion = {
      playerId: championId,
      monster: {
        ...player.monster,
        stats: { ...player.monster.stats },
        passives: player.monster.passives.map((p) => ({ ...p })),
        actives: player.monster.actives.map((a) => ({ ...a })),
      },
    };
    state.champion = champ;
    state.log.push({ kind: 'champion', playerId: championId });
  }
  state.phase = 'finished';
  state.log.push({
    kind: 'phase_change',
    phase: 'finished',
    round: state.round,
    miniRound: state.miniRound,
  });
}

function runMatch(
  state: GameState,
  aId: string,
  bId: string,
  roundIdx: number,
  tournament: TournamentState,
): string {
  if (aId === '__bye__') return bId;
  if (bId === '__bye__') return aId;
  const a = getPlayer(state, aId);
  const b = getPlayer(state, bId);
  if (!a.monster || !b.monster) {
    return a.monster ? aId : bId;
  }
  // Tournament matches reroll on draws to guarantee a winner.
  let attempt = 0;
  let winnerSide: 'a' | 'b' = 'a';
  let lastLog;
  while (attempt < 4) {
    const monA = snapshotMonsterForBattle(a);
    const monB = snapshotMonsterForBattle(b);
    const rng = makeRng(state);
    const matchSeed = rng.int(1, 0x7fffffff) + attempt;
    saveRng(state, rng);
    const result = runBattle(monA, monB, matchSeed);
    lastLog = result.log;
    if (result.winner === 'a' || result.winner === 'b') {
      winnerSide = result.winner;
      break;
    }
    attempt++;
  }
  const winnerId = winnerSide === 'a' ? aId : bId;
  const match: TournamentMatch = {
    round: roundIdx,
    matchIdx: tournament.bracket.length,
    a: aId,
    b: bId,
    winner: winnerId,
    log: lastLog ?? [],
  };
  tournament.bracket.push(match);
  state.log.push({ kind: 'tournament_match', round: roundIdx, a: aId, b: bId, winner: winnerId });
  return winnerId;
}
