/**
 * Simple WebSocket smoke test:
 *  1. Connect two clients.
 *  2. Client A creates a room.
 *  3. Client B joins it.
 *  4. Verify both observe a 2-player room state.
 *
 * Usage: tsx scripts/ws-smoke.ts [ws://host:port/ws]
 */
import WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from '../src/shared/messages';

const url = process.argv[2] ?? 'ws://localhost:3001/ws';

type Client = {
  ws: WebSocket;
  playerId: string | null;
  room: ServerMessage extends { type: 'room_state'; room: infer R } ? R | null : null;
  rooms: ServerMessage extends { type: 'rooms_list'; rooms: infer R } ? R : never[];
  send: (msg: ClientMessage) => void;
  waitFor: (predicate: (msg: ServerMessage) => boolean, timeoutMs?: number) => Promise<ServerMessage>;
  close: () => void;
};

function makeClient(label: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const queue: ServerMessage[] = [];
    const waiters: { predicate: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }[] = [];
    const client: Client = {
      ws,
      playerId: null,
      room: null,
      rooms: [] as never[],
      send: (msg) => ws.send(JSON.stringify(msg)),
      waitFor: (predicate, timeoutMs = 3000) =>
        new Promise((res, rej) => {
          for (const m of queue) {
            if (predicate(m)) {
              queue.splice(queue.indexOf(m), 1);
              res(m);
              return;
            }
          }
          const timer = setTimeout(() => {
            const idx = waiters.findIndex((w) => w.timer === timer);
            if (idx >= 0) waiters.splice(idx, 1);
            rej(new Error(`[${label}] waitFor timed out`));
          }, timeoutMs);
          waiters.push({ predicate, resolve: res, reject: rej, timer });
        }),
      close: () => ws.close(),
    };
    ws.on('open', () => resolve(client));
    ws.on('error', reject);
    ws.on('message', (raw) => {
      const msg: ServerMessage = JSON.parse(raw.toString());
      if (msg.type === 'welcome') client.playerId = msg.playerId;
      if (msg.type === 'room_state') client.room = msg.room as never;
      if (msg.type === 'rooms_list') client.rooms = msg.rooms as never;
      const idx = waiters.findIndex((w) => w.predicate(msg));
      if (idx >= 0) {
        const w = waiters[idx]!;
        clearTimeout(w.timer);
        waiters.splice(idx, 1);
        w.resolve(msg);
      } else {
        queue.push(msg);
      }
      console.log(`[${label}] <-`, JSON.stringify(msg).slice(0, 160));
    });
  });
}

async function main(): Promise<void> {
  const a = await makeClient('A');
  const b = await makeClient('B');
  await a.waitFor((m) => m.type === 'welcome');
  await b.waitFor((m) => m.type === 'welcome');

  a.send({ type: 'create_room', playerName: 'Alice' });
  const aRoom = await a.waitFor((m) => m.type === 'room_state');
  if (aRoom.type !== 'room_state') throw new Error('expected room_state');
  console.log('Created room:', aRoom.room.id);

  // B sees the new room in the lobby list (push from server).
  await b.waitFor((m) => m.type === 'rooms_list' && m.rooms.some((r) => r.id === aRoom.room.id));

  b.send({ type: 'join_room', roomId: aRoom.room.id, playerName: 'Bob' });
  const bRoom = await b.waitFor((m) => m.type === 'room_state' && m.room.players.length === 2);
  const aRoomAfter = await a.waitFor(
    (m) => m.type === 'room_state' && m.room.players.length === 2,
  );

  if (bRoom.type !== 'room_state' || aRoomAfter.type !== 'room_state') {
    throw new Error('expected both clients to observe a 2-player room');
  }

  console.log('\n=== Smoke test passed ===');
  console.log('Room ID:', aRoom.room.id);
  console.log('Players:', bRoom.room.players.map((p) => p.name).join(', '));

  a.close();
  b.close();
  setTimeout(() => process.exit(0), 100);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
