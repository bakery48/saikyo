import { describe, expect, it, vi } from 'vitest';
import { GameWsServer } from '../src/server/ws-server';
import type { ClientMessage, ServerMessage } from '../src/shared/messages';

/** Minimal stand-in for the `ws` WebSocket the server interacts with. */
class MockWs {
  static OPEN = 1;
  OPEN = 1;
  readyState = 1;
  sent: ServerMessage[] = [];
  private handlers: Record<string, ((arg?: unknown) => void)[]> = {};

  on(event: string, fn: (arg?: unknown) => void): void {
    (this.handlers[event] ??= []).push(fn);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerMessage);
  }
  emit(event: string, arg?: unknown): void {
    for (const fn of this.handlers[event] ?? []) fn(arg);
  }
  /** Simulate the client sending a message to the server. */
  client(msg: ClientMessage): void {
    this.emit('message', Buffer.from(JSON.stringify(msg)));
  }
  /** Pull the playerId out of the welcome message. */
  welcomeId(): string {
    const w = this.sent.find((m) => m.type === 'welcome');
    if (w?.type !== 'welcome') throw new Error('no welcome');
    return w.playerId;
  }
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      if (this.sent[i]!.type === type) return this.sent[i] as Extract<ServerMessage, { type: T }>;
    }
    throw new Error(`no ${type} message`);
  }
}

describe('mid-game reconnect (approach C)', () => {
  it('a disconnected human keeps their seat and stays human after rejoin', () => {
    vi.useFakeTimers();
    const server = new GameWsServer();

    // Host + one more human; CPUs fill the rest.
    const wsHost = new MockWs();
    server.handleConnection(wsHost as never);
    const hostId = wsHost.welcomeId();

    const wsP2 = new MockWs();
    server.handleConnection(wsP2 as never);
    const p2Id = wsP2.welcomeId();

    wsHost.client({ type: 'create_room', playerName: 'Host' });
    const roomId = wsHost.last('room_state').room.id;
    wsP2.client({ type: 'join_room', roomId, playerName: 'P2' });

    wsHost.client({ type: 'set_ready', isReady: true });
    wsP2.client({ type: 'set_ready', isReady: true });
    wsHost.client({ type: 'start_game' });

    // Game is running and the host is a human seat.
    const gs1 = wsHost.last('game_state').state;
    const hostInGame = gs1.players.find((p) => p.id === hostId)!;
    expect(hostInGame).toBeDefined();
    expect(hostInGame.isCPU).toBe(false);

    // Host's browser reloads: the socket closes.
    wsHost.emit('close');

    // Within the grace window the host reconnects with a fresh socket.
    const wsHost2 = new MockWs();
    server.handleConnection(wsHost2 as never);
    wsHost2.client({ type: 'rejoin', playerId: hostId });

    // Rejoin succeeded and the seat is still a human.
    expect(wsHost2.last('rejoin_ok').playerId).toBe(hostId);
    const gs2 = wsHost2.last('game_state').state;
    const hostAfter = gs2.players.find((p) => p.id === hostId)!;
    expect(hostAfter.isCPU).toBe(false);

    // Letting the grace timer run should NOT convert them now (it was cleared).
    vi.runAllTimers();
    const gs3 = wsHost2.last('game_state').state;
    expect(gs3.players.find((p) => p.id === hostId)!.isCPU).toBe(false);
    vi.useRealTimers();
  });

  it('rejoin still works when it races ahead of the old socket close', () => {
    vi.useFakeTimers();
    const server = new GameWsServer();

    const wsHost = new MockWs();
    server.handleConnection(wsHost as never);
    const hostId = wsHost.welcomeId();
    const wsP2 = new MockWs();
    server.handleConnection(wsP2 as never);

    wsHost.client({ type: 'create_room', playerName: 'Host' });
    const roomId = wsHost.last('room_state').room.id;
    wsP2.client({ type: 'join_room', roomId, playerName: 'P2' });
    wsHost.client({ type: 'set_ready', isReady: true });
    wsP2.client({ type: 'set_ready', isReady: true });
    wsHost.client({ type: 'start_game' });

    // Reload race: the fresh socket connects and rejoins BEFORE the old
    // socket's close event is processed.
    const wsHost2 = new MockWs();
    server.handleConnection(wsHost2 as never);
    wsHost2.client({ type: 'rejoin', playerId: hostId });
    // Old socket's close finally arrives — must be a no-op now.
    wsHost.emit('close');

    expect(wsHost2.last('rejoin_ok').playerId).toBe(hostId);
    // Even after timers run, the seat must remain a human.
    vi.runAllTimers();
    const gs = wsHost2.last('game_state').state;
    expect(gs.players.find((p) => p.id === hostId)!.isCPU).toBe(false);
    vi.useRealTimers();
  });

  it('a disconnected human falls back to CPU once the grace window expires', () => {
    vi.useFakeTimers();
    const server = new GameWsServer();

    const wsHost = new MockWs();
    server.handleConnection(wsHost as never);
    const hostId = wsHost.welcomeId();
    const wsP2 = new MockWs();
    server.handleConnection(wsP2 as never);

    wsHost.client({ type: 'create_room', playerName: 'Host' });
    const roomId = wsHost.last('room_state').room.id;
    wsP2.client({ type: 'join_room', roomId, playerName: 'P2' });
    wsHost.client({ type: 'set_ready', isReady: true });
    wsP2.client({ type: 'set_ready', isReady: true });
    wsHost.client({ type: 'start_game' });

    wsHost.emit('close');
    // No rejoin — let the grace window expire.
    vi.runAllTimers();

    // P2's view should now show the host as a CPU seat.
    const gs = wsP2.last('game_state').state;
    const hostAfter = gs.players.find((p) => p.id === hostId)!;
    expect(hostAfter.isCPU).toBe(true);
    vi.useRealTimers();
  });
});
