import type { FastifyInstance } from "fastify";
import type { WsHub } from "../lib/ws-hub.js";

/**
 * GET /ws — WebSocket upgrade endpoint.
 *
 * Clients connect here and send {type: "subscribe", channel: "..."}
 * messages to start receiving events. See WsHub for the full
 * protocol.
 */
export async function registerWsRoutes(
  app: FastifyInstance,
  hub: WsHub,
): Promise<void> {
  app.get(
    "/ws",
    { websocket: true },
    (connection /*, _request */) => {
      // @fastify/websocket v10+ passes the raw WebSocket as the
      // first argument, not { socket }.  Handle both shapes.
      const socket =
        typeof (connection as { send?: unknown }).send === "function"
          ? (connection as unknown as import("ws").WebSocket)
          : (connection as { socket: import("ws").WebSocket }).socket;
      hub.handleConnection(socket);
    },
  );
}
