/**
 * Holdem routes: HTTP lobby + WebSocket game connection.
 *
 * GET  /api/v1/holdem/rooms          — list rooms
 * POST /api/v1/holdem/rooms          — create room
 * POST /api/v1/holdem/quick-join     — find or create a room, join it
 * GET  /api/v1/holdem/play/:roomId   — WebSocket upgrade for gameplay
 */

import type { FastifyInstance } from "fastify";
import { HoldemLobby } from "../lib/holdem/lobby.js";
import type WebSocket from "ws";

const lobby = new HoldemLobby();

// Cleanup empty rooms every 60s
setInterval(() => lobby.cleanup(), 60_000);

export async function registerHoldemRoutes(app: FastifyInstance): Promise<void> {

  // --- HTTP Lobby ---

  app.get("/api/v1/holdem/rooms", async () => {
    return { rooms: lobby.listRooms() };
  });

  app.post("/api/v1/holdem/rooms", async () => {
    const room = lobby.createRoom();
    return { roomId: room.id };
  });

  app.post<{ Body: { playerName?: string } }>("/api/v1/holdem/quick-join", async (req) => {
    const room = lobby.findOrCreateRoom();
    return { roomId: room.id };
  });

  // --- WebSocket Game ---

  app.get<{ Params: { roomId: string }; Querystring: { name?: string } }>(
    "/api/v1/holdem/play/:roomId",
    { websocket: true },
    (socket: WebSocket, req) => {
      const roomId = req.params.roomId;
      const playerName = req.query.name ?? "Player";
      const room = lobby.getRoom(roomId);

      if (!room) {
        socket.send(JSON.stringify({ type: "error", message: "Room not found" }));
        socket.close();
        return;
      }

      // Generate a session ID for this connection
      const playerId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const seat = room.addPlayer(playerId, playerName);

      if (seat < 0) {
        socket.send(JSON.stringify({ type: "error", message: "Table is full" }));
        socket.close();
        return;
      }

      // Send welcome
      socket.send(JSON.stringify({
        type: "welcome",
        playerId,
        seat,
        roomId,
      }));

      // Subscribe to room events
      room.subscribe(playerId, (event: string, data: unknown) => {
        try {
          socket.send(JSON.stringify({ type: event, data }));
        } catch { /* socket may be closing */ }
      });

      // Send initial state
      socket.send(JSON.stringify({
        type: "game_state",
        data: room.getStateForPlayer(playerId),
      }));

      // Start hand if this is the first human
      if (room.humanCount() === 1) {
        setTimeout(() => room.startHand(), 500);
      }

      // Handle incoming messages
      socket.on("message", (raw: Buffer | string) => {
        let msg: { type: string; action?: string; betSize?: number };
        try {
          msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
        } catch { return; }

        if (msg.type === "action" && msg.action) {
          room.playerAction(playerId, msg.action, msg.betSize);
        } else if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      });

      // Cleanup on disconnect
      socket.on("close", () => {
        room.removePlayer(playerId);
        room.unsubscribe(playerId);
      });

      socket.on("error", () => {
        room.removePlayer(playerId);
        room.unsubscribe(playerId);
      });
    },
  );
}
