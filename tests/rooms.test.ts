import { beforeEach, describe, expect, it } from 'vitest';
import { RoomManager } from '../src/server/rooms';

const mkPlayer = (id: string, name = id) => ({ id, name, isReady: false });

describe('RoomManager', () => {
  let mgr: RoomManager;
  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('createRoom: creates a 4-char room with the creator as host', () => {
    const room = mgr.createRoom(mkPlayer('p1', 'Alice'));
    expect(room.id).toMatch(/^[A-Z0-9]{4}$/);
    expect(room.hostId).toBe('p1');
    expect(room.players).toHaveLength(1);
  });

  it('joinRoom: adds a player and tracks membership', () => {
    const room = mgr.createRoom(mkPlayer('p1'));
    mgr.joinRoom(room.id, mkPlayer('p2'));
    const view = mgr.toRoomView(mgr.getRoom(room.id)!);
    expect(view.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(view.players.find((p) => p.isHost)?.id).toBe('p1');
  });

  it('joinRoom: rejects if room is full (8 max)', () => {
    const room = mgr.createRoom(mkPlayer('p1'));
    for (let i = 2; i <= 8; i++) {
      mgr.joinRoom(room.id, mkPlayer(`p${i}`));
    }
    expect(() => mgr.joinRoom(room.id, mkPlayer('p9'))).toThrow(/full/);
  });

  it('joinRoom: rejects unknown room', () => {
    expect(() => mgr.joinRoom('NOPE', mkPlayer('p1'))).toThrow(/not found/);
  });

  it('joinRoom: rejects player already in another room', () => {
    const room = mgr.createRoom(mkPlayer('p1'));
    mgr.createRoom(mkPlayer('p2'));
    expect(() => mgr.joinRoom(room.id, mkPlayer('p2'))).toThrow(/already/);
  });

  it('leavePlayer: removes player and reassigns host', () => {
    const room = mgr.createRoom(mkPlayer('p1'));
    mgr.joinRoom(room.id, mkPlayer('p2'));
    const result = mgr.leavePlayer('p1');
    expect(result.destroyed).toBe(false);
    expect(result.room?.hostId).toBe('p2');
    expect(result.room?.players.map((p) => p.id)).toEqual(['p2']);
  });

  it('leavePlayer: destroys room when last player leaves', () => {
    const room = mgr.createRoom(mkPlayer('p1'));
    const result = mgr.leavePlayer('p1');
    expect(result.destroyed).toBe(true);
    expect(mgr.getRoom(room.id)).toBeNull();
  });

  it('setReady: flips the ready flag', () => {
    mgr.createRoom(mkPlayer('p1'));
    const room = mgr.setReady('p1', true);
    expect(room?.players[0]?.isReady).toBe(true);
    mgr.setReady('p1', false);
    expect(mgr.getRoomByPlayer('p1')?.players[0]?.isReady).toBe(false);
  });

  it('listSummaries: returns one entry per active room', () => {
    mgr.createRoom(mkPlayer('p1', 'Alice'));
    mgr.createRoom(mkPlayer('p2', 'Bob'));
    const summaries = mgr.listSummaries();
    expect(summaries).toHaveLength(2);
    const hosts = summaries.map((s) => s.hostName).sort();
    expect(hosts).toEqual(['Alice', 'Bob']);
  });

  it('toRoomView: marks the host correctly', () => {
    const room = mgr.createRoom(mkPlayer('p1', 'Alice'));
    mgr.joinRoom(room.id, mkPlayer('p2', 'Bob'));
    const view = mgr.toRoomView(room);
    expect(view.players.find((p) => p.name === 'Alice')?.isHost).toBe(true);
    expect(view.players.find((p) => p.name === 'Bob')?.isHost).toBe(false);
  });

  it('player can re-create room after leaving', () => {
    const r1 = mgr.createRoom(mkPlayer('p1'));
    mgr.leavePlayer('p1');
    expect(mgr.getRoom(r1.id)).toBeNull();
    const r2 = mgr.createRoom(mkPlayer('p1'));
    expect(r2.id).not.toBe(r1.id);
  });
});
