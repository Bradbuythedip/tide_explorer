/**
 * Manages poker rooms and player sessions.
 * Simple in-memory store — no database needed for play-money games.
 */

import { HoldemRoom } from "./room.js";

export interface RoomSummary {
  roomId: string;
  players: number;
  maxPlayers: number;
  handNumber: number;
  phase: string;
}

export class HoldemLobby {
  private rooms = new Map<string, HoldemRoom>();

  /** Create a new room, fill with bots, return it. */
  createRoom(): HoldemRoom {
    const room = new HoldemRoom();
    this.rooms.set(room.id, room);
    room.fillBots();
    return room;
  }

  getRoom(roomId: string): HoldemRoom | undefined {
    return this.rooms.get(roomId);
  }

  /** Find a room with space, or create one. */
  findOrCreateRoom(): HoldemRoom {
    for (const room of this.rooms.values()) {
      if (room.humanCount() < 5) return room;
    }
    return this.createRoom();
  }

  listRooms(): RoomSummary[] {
    const list: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      const state = room.getStateForPlayer("__lobby__");
      list.push({
        roomId: room.id,
        players: room.humanCount(),
        maxPlayers: 6,
        handNumber: state.handNumber,
        phase: state.phase,
      });
    }
    return list;
  }

  removeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.destroy();
      this.rooms.delete(roomId);
    }
  }

  /** Clean up empty rooms periodically. */
  cleanup() {
    for (const [id, room] of this.rooms) {
      if (room.humanCount() === 0) {
        room.destroy();
        this.rooms.delete(id);
      }
    }
  }
}
