import type { Champion, GameState, TournamentMatch, TournamentState } from '../types';
import { runBattle } from '../battle';
import { shuffle } from '../deck';
import { snapshotMonsterForBattle } from './battle';
import { getPlayer, makeRng, saveRng } from '../state';

/**
 * Initialize the tournament: build the seeded bracket but don't run matches yet.
 * Subsequent calls to `stepTournamentMatch` run one match at a time so the
 * ws layer can pause for battle animations between them.
 */
export function startTournament(state: GameState): void {
  if (state.phase !== 'tournament') throw new Error('not in tournament phase');
  if (state.tournament) return;
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

  const totalRounds = size > 1 ? Math.log2(size) : 0;
  // rounds[0] = round 1 roster, rounds[r] = winners after round r (= round r+1 roster),
  // rounds[totalRounds] = final champion (single element).
  const rounds: string[][] = [competitors.slice()];
  for (let r = 1; r <= totalRounds; r++) rounds.push([]);

  state.tournament = {
    bracket: [],
    rounds,
    currentRound: 1,
    pairIdx: 0,
    totalRounds,
    champion: null,
  };
}

/**
 * Run a single tournament match. Returns true when the entire tournament is
 * complete (champion decided, phase advanced to 'finished').
 */
export function stepTournamentMatch(state: GameState): boolean {
  if (state.phase !== 'tournament') throw new Error('not in tournament phase');
  if (!state.tournament) startTournament(state);
  const t = state.tournament!;
  if (t.totalRounds === 0) {
    // Single (or zero) competitor: skip straight to finish.
    finalizeTournament(state, t.rounds[0]?.[0] ?? null);
    return true;
  }

  const currentRoundPlayers = t.rounds[t.currentRound - 1]!;
  const aIdx = t.pairIdx * 2;
  const bIdx = aIdx + 1;
  const aId = currentRoundPlayers[aIdx]!;
  const bId = currentRoundPlayers[bIdx]!;
  const winner = runMatch(state, aId, bId, t.currentRound, t);
  t.rounds[t.currentRound]?.push(winner);
  t.pairIdx += 1;

  // Reached end of current round?
  if (t.pairIdx * 2 >= currentRoundPlayers.length) {
    if (t.currentRound >= t.totalRounds) {
      const championId = t.rounds[t.currentRound]?.[0] ?? null;
      finalizeTournament(state, championId);
      return true;
    }
    t.currentRound += 1;
    t.pairIdx = 0;
  }
  return false;
}

function finalizeTournament(state: GameState, championId: string | null): void {
  const t = state.tournament;
  if (championId && championId !== '__bye__' && t) {
    t.champion = championId;
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
  }
  state.nextBattleReverseActives = false;
  state.phase = 'finished';
  state.log.push({
    kind: 'phase_change',
    phase: 'finished',
    round: state.round,
    miniRound: state.miniRound,
  });
}

/** @deprecated Use `startTournament` + repeated `stepTournamentMatch`. Kept for tests. */
export function runTournament(state: GameState): void {
  startTournament(state);
  while (state.phase === 'tournament') {
    stepTournamentMatch(state);
  }
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
  let startHpA = a.monster.stats.hp;
  let startHpB = b.monster.stats.hp;
  let finalHpA = 0;
  let finalHpB = 0;
  while (attempt < 4) {
    const monA = snapshotMonsterForBattle(a);
    const monB = snapshotMonsterForBattle(b);
    if (state.nextBattleReverseActives) {
      for (const x of monA.actives) x.order = monA.actives.length + 1 - x.order;
      for (const x of monB.actives) x.order = monB.actives.length + 1 - x.order;
    }
    const rng = makeRng(state);
    const matchSeed = rng.int(1, 0x7fffffff) + attempt;
    saveRng(state, rng);
    const result = runBattle(monA, monB, matchSeed);
    lastLog = result.log;
    startHpA = monA.stats.hp;
    startHpB = monB.stats.hp;
    finalHpA = result.finalHp.a;
    finalHpB = result.finalHp.b;
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
    startHpA,
    startHpB,
    finalHpA,
    finalHpB,
    log: lastLog ?? [],
  };
  tournament.bracket.push(match);
  state.log.push({ kind: 'tournament_match', round: roundIdx, a: aId, b: bId, winner: winnerId });
  return winnerId;
}
