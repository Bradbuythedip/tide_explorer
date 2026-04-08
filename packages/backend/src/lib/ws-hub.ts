/**
 * WebSocket hub — routes events from the EventPoller to subscribed
 * clients by channel name.
 *
 * Protocol (simple, no JSON-RPC, no schema lib):
 *
 *   Client -> Server:
 *     {"type": "subscribe",   "channel": "blocks" | "mempool" | "status"}
 *     {"type": "unsubscribe", "channel": "..."}
 *     {"type": "ping"}
 *
 *   Server -> Client:
 *     {"type": "welcome"}                        sent on connect
 *     {"type": "subscribed",   "channel": "..."} ack
 *     {"type": "unsubscribed", "channel": "..."} ack
 *     {"type": "pong"}                           response to ping
 *     {"type": "event", "channel": "blocks"  | "mempool" | "status",
 *                       "payload": <PollerEvent>}
 *     {"type": "error", "message": "..."}        on bad input
 *
 * No auth because all channels are public read-only.
 * No rate limiting because the backend is behind Railway's edge.
 */

import type { WebSocket } from "ws";
import type { Logger } from "pino";
import type { EventPoller, PollerEvent } from "./event-poller.js";

type Channel = "blocks" | "mempool" | "status";
const VALID_CHANNELS: readonly Channel[] = ["blocks", "mempool", "status"];

interface ClientState {
  subscriptions: Set<Channel>;
}

export interface WsHubDeps {
  poller: EventPoller;
  logger: Logger;
}

export class WsHub {
  private clients = new Map<WebSocket, ClientState>();

  constructor(private readonly deps: WsHubDeps) {
    // Subscribe the hub itself to the poller once; fan out to
    // individual clients from our own map.
    deps.poller.bus.on("event", (event) => this.fanOut(event));
  }

  /** Called by the Fastify ws route whenever a client connects. */
  handleConnection(socket: WebSocket): void {
    this.clients.set(socket, { subscriptions: new Set() });
    this.send(socket, { type: "welcome" });

    socket.on("message", (raw) => {
      this.handleMessage(socket, raw.toString());
    });

    socket.on("close", () => {
      this.clients.delete(socket);
    });

    socket.on("error", (err) => {
      this.deps.logger.debug({ err }, "ws client error");
      this.clients.delete(socket);
    });
  }

  private handleMessage(socket: WebSocket, raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(socket, { type: "error", message: "invalid JSON" });
      return;
    }
    if (typeof msg !== "object" || msg === null || !("type" in msg)) {
      this.send(socket, { type: "error", message: "expected { type: ... }" });
      return;
    }
    const m = msg as { type: string; channel?: string };

    switch (m.type) {
      case "ping":
        this.send(socket, { type: "pong" });
        return;

      case "subscribe": {
        const chan = m.channel;
        if (!chan || !VALID_CHANNELS.includes(chan as Channel)) {
          this.send(socket, {
            type: "error",
            message: `unknown channel; valid: ${VALID_CHANNELS.join(", ")}`,
          });
          return;
        }
        const state = this.clients.get(socket);
        if (!state) return;
        state.subscriptions.add(chan as Channel);
        this.send(socket, { type: "subscribed", channel: chan });
        return;
      }

      case "unsubscribe": {
        const chan = m.channel;
        if (!chan || !VALID_CHANNELS.includes(chan as Channel)) {
          this.send(socket, { type: "error", message: "unknown channel" });
          return;
        }
        const state = this.clients.get(socket);
        if (!state) return;
        state.subscriptions.delete(chan as Channel);
        this.send(socket, { type: "unsubscribed", channel: chan });
        return;
      }

      default:
        this.send(socket, {
          type: "error",
          message: `unknown message type: ${m.type}`,
        });
    }
  }

  private fanOut(event: PollerEvent): void {
    const channel: Channel = event.type;
    // Iterate and send to every client subscribed to this channel.
    // Dead sockets are cleaned up by the 'close' handler separately.
    for (const [socket, state] of this.clients) {
      if (!state.subscriptions.has(channel)) continue;
      try {
        this.send(socket, { type: "event", channel, payload: event });
      } catch (err) {
        this.deps.logger.debug({ err }, "ws fanout send failed");
      }
    }
  }

  private send(socket: WebSocket, msg: unknown): void {
    if (socket.readyState !== 1 /* OPEN */) return;
    socket.send(JSON.stringify(msg));
  }

  /** Number of connected clients. Used by /healthz style endpoints. */
  get clientCount(): number {
    return this.clients.size;
  }
}
