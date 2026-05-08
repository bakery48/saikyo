/**
 * End-to-end smoke test: connect a single WS client, create a room, start
 * a game (which fills with CPUs), drive the human through every required
 * choice, and verify the game finishes with a champion.
 *
 * Usage: tsx scripts/game-smoke.ts [ws://host:port/ws]
 */
import WebSocket from 'ws';
import type { ClientGameState, ClientMessage, ServerMessage } from '../src/shared/messages';

const url = process.argv[2] ?? 'ws://localhost:3001/ws';
const TIMEOUT_MS = 10_000;

type Pending = {
  predicate: (m: ServerMessage) => boolean;
  resolve: (m: ServerMessage) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};

class Client {
  ws: WebSocket;
  playerId: string | null = null;
  game: ClientGameState | null = null;
  private queue: ServerMessage[] = [];
  private pending: Pending[] = [];

  constructor(label: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (raw) => {
      const msg: ServerMessage = JSON.parse(raw.toString());
      if (msg.type === 'welcome') this.playerId = msg.playerId;
      if (msg.type === 'game_state') this.game = msg.state;
      const idx = this.pending.findIndex((p) => p.predicate(msg));
      if (idx >= 0) {
        const p = this.pending[idx]!;
        clearTimeout(p.timer);
        this.pending.splice(idx, 1);
        p.resolve(msg);
      } else {
        this.queue.push(msg);
      }
      // Compress noisy log line.
      const summary =
        msg.type === 'game_state'
          ? `game_state phase=${msg.state.phase} R${msg.state.round} M${msg.state.miniRound}`
          : msg.type === 'rooms_list'
            ? `rooms_list (${msg.rooms.length})`
            : JSON.stringify(msg).slice(0, 140);
      console.log(`[${label}]`, summary);
    });
    this.ws.on('error', (e) => console.error(`[${label}] ws error`, e));
  }

  open(): Promise<void> {
    return new Promise((res) => this.ws.once('open', () => res()));
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor<T extends ServerMessage>(predicate: (m: ServerMessage) => m is T): Promise<T>;
  waitFor(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage>;
  waitFor(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    for (const m of this.queue) {
      if (predicate(m)) {
        this.queue.splice(this.queue.indexOf(m), 1);
        return Promise.resolve(m);
      }
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.timer === timer);
        if (idx >= 0) this.pending.splice(idx, 1);
        reject(new Error('waitFor timed out'));
      }, TIMEOUT_MS);
      this.pending.push({ predicate, resolve, reject, timer });
    });
  }

  close(): void {
    this.ws.close();
  }
}

async function main(): Promise<void> {
  const c = new Client('H');
  await c.open();
  await c.waitFor((m) => m.type === 'welcome');

  c.send({ type: 'create_room', playerName: 'Hero' });
  await c.waitFor((m) => m.type === 'room_state');

  c.send({ type: 'start_game' });
  await c.waitFor((m) => m.type === 'game_state');

  let safety = 400;
  while (c.game && c.game.phase !== 'finished' && safety-- > 0) {
    const state = c.game;
    if (state.phase === 'pick_monster' && state.pickOrder[state.pickIdx] === c.playerId) {
      c.send({ type: 'submit_pick', baseId: state.monsterPool[0]!.baseId });
    } else if (
      state.phase === 'draft' &&
      state.draft &&
      state.draft.pendingPlayerIds.includes(c.playerId!) &&
      !state.draft.submittedPicks[c.playerId!]
    ) {
      const used = new Set(Object.values(state.draft.submittedPicks));
      const pick = state.draft.pool.find((card) => !used.has(card.id)) ?? state.draft.pool[0]!;
      c.send({ type: 'submit_draft', skillId: pick.id });
    } else if (
      state.phase === 'reward' &&
      state.reward &&
      state.reward.pendingPlayerIds.includes(c.playerId!) &&
      !state.reward.choices[c.playerId!]
    ) {
      c.send({ type: 'submit_reward', choice: { kind: 'skill_top' } });
    }
    // After taking (or skipping) an action, wait for the next state push.
    await c.waitFor((m) => m.type === 'game_state');
  }

  if (c.game?.phase !== 'finished') {
    throw new Error(`game did not finish (phase=${c.game?.phase})`);
  }
  if (!c.game.champion) throw new Error('no champion');

  console.log('\n=== Game smoke test passed ===');
  const champ = c.game.champion;
  const champPlayer = c.game.players.find((p) => p.id === champ.playerId);
  console.log(`Champion: ${champPlayer?.name} (${champ.monster.name})`);
  console.log(
    `  HP${champ.monster.stats.hp} ATK${champ.monster.stats.atk} DEF${champ.monster.stats.def} SPD${champ.monster.stats.spd}`,
  );

  c.close();
  setTimeout(() => process.exit(0), 100);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
