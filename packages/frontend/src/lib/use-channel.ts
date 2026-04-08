"use client";

/**
 * useChannel — React hook for subscribing to a backend WebSocket
 * channel.
 *
 * Connects to the URL in NEXT_PUBLIC_BACKEND_WS_URL (e.g.
 * wss://prevblockbackend-production.up.railway.app/ws), sends a
 * {type:"subscribe", channel:<name>} message, and calls the
 * onEvent callback with each decoded event payload.
 *
 * Reconnects with exponential backoff capped at 30s. The socket is
 * shared across every hook instance for the same backend URL, so
 * multiple components subscribing to different channels only open
 * one connection.
 *
 * Use like:
 *   useChannel('blocks', (ev) => setBlocks(prev => [ev.block, ...prev]));
 *
 * The callback is captured by ref so you don't need to memoize it.
 */

import { useEffect, useRef } from "react";

type Channel = "blocks" | "mempool" | "status";

// Minimal server message shapes. Keep in sync with ws-hub.ts.
type ServerMessage =
  | { type: "welcome" }
  | { type: "subscribed"; channel: Channel }
  | { type: "unsubscribed"; channel: Channel }
  | { type: "pong" }
  | { type: "error"; message: string }
  | { type: "event"; channel: Channel; payload: unknown };

interface SharedSocket {
  ws: WebSocket | null;
  listeners: Map<Channel, Set<(payload: unknown) => void>>;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  desiredSubscriptions: Set<Channel>;
}

// Module-scoped singleton per URL. useChannel instances share it.
const sockets = new Map<string, SharedSocket>();

function getBackendWsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    null;
  if (!raw) {
    // Derive from the current page origin as a last resort. Works
    // locally when the dev server and backend are same-origin.
    return `${window.location.origin.replace(/^http/, "ws")}/ws`;
  }
  // Accept both http(s) and ws(s) as input; normalise to ws(s).
  let url = raw.replace(/\/+$/, "");
  url = url.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  if (!/^wss?:\/\//.test(url)) url = "wss://" + url;
  if (!url.endsWith("/ws")) url = url + "/ws";
  return url;
}

function ensureSocket(url: string): SharedSocket {
  let shared = sockets.get(url);
  if (shared) return shared;

  shared = {
    ws: null,
    listeners: new Map(),
    reconnectAttempt: 0,
    reconnectTimer: null,
    pingTimer: null,
    desiredSubscriptions: new Set(),
  };
  sockets.set(url, shared);
  connect(url, shared);
  return shared;
}

function connect(url: string, shared: SharedSocket): void {
  try {
    shared.ws = new WebSocket(url);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[useChannel] WebSocket construct failed", err);
    scheduleReconnect(url, shared);
    return;
  }

  const ws = shared.ws;

  ws.addEventListener("open", () => {
    shared.reconnectAttempt = 0;
    // Replay desired subscriptions after reconnect.
    for (const channel of shared.desiredSubscriptions) {
      ws.send(JSON.stringify({ type: "subscribe", channel }));
    }
    // Lightweight keepalive. Server replies with {type:"pong"} and
    // we ignore it; this mostly keeps intermediaries from closing
    // idle sockets.
    if (shared.pingTimer !== null) clearInterval(shared.pingTimer);
    shared.pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);
  });

  ws.addEventListener("message", (msgEvent) => {
    let parsed: ServerMessage;
    try {
      parsed = JSON.parse(msgEvent.data as string);
    } catch {
      return;
    }
    if (parsed.type !== "event") return;
    const bucket = shared.listeners.get(parsed.channel);
    if (!bucket) return;
    for (const cb of bucket) {
      try {
        cb(parsed.payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[useChannel] listener threw", err);
      }
    }
  });

  const closeHandler = () => {
    if (shared.pingTimer !== null) {
      clearInterval(shared.pingTimer);
      shared.pingTimer = null;
    }
    shared.ws = null;
    scheduleReconnect(url, shared);
  };

  ws.addEventListener("close", closeHandler);
  ws.addEventListener("error", () => {
    // Let close handler do the actual reconnect; error fires first
    // but close follows immediately and is the canonical signal.
  });
}

function scheduleReconnect(url: string, shared: SharedSocket): void {
  if (shared.listeners.size === 0) {
    // Nobody cares any more; don't reconnect.
    return;
  }
  shared.reconnectAttempt += 1;
  const delay = Math.min(30_000, 500 * 2 ** (shared.reconnectAttempt - 1));
  if (shared.reconnectTimer !== null) clearTimeout(shared.reconnectTimer);
  shared.reconnectTimer = setTimeout(() => {
    shared.reconnectTimer = null;
    connect(url, shared);
  }, delay);
}

function addListener(
  url: string,
  channel: Channel,
  cb: (payload: unknown) => void,
): () => void {
  const shared = ensureSocket(url);

  let bucket = shared.listeners.get(channel);
  if (!bucket) {
    bucket = new Set();
    shared.listeners.set(channel, bucket);
  }
  bucket.add(cb);

  // Track desired subs so reconnect can replay them, and send the
  // subscribe message now if the socket is already open.
  shared.desiredSubscriptions.add(channel);
  if (shared.ws?.readyState === WebSocket.OPEN) {
    shared.ws.send(JSON.stringify({ type: "subscribe", channel }));
  }

  return () => {
    bucket!.delete(cb);
    if (bucket!.size === 0) {
      shared.listeners.delete(channel);
      shared.desiredSubscriptions.delete(channel);
      if (shared.ws?.readyState === WebSocket.OPEN) {
        shared.ws.send(JSON.stringify({ type: "unsubscribe", channel }));
      }
    }
  };
}

export function useChannel<T = unknown>(
  channel: Channel,
  onEvent: (payload: T) => void,
): void {
  // Capture latest callback in a ref so consumers can pass inline
  // arrow functions without rebinding on every render.
  const cbRef = useRef(onEvent);
  useEffect(() => {
    cbRef.current = onEvent;
  });

  useEffect(() => {
    const url = getBackendWsUrl();
    if (!url) return;
    const dispose = addListener(url, channel, (payload) => {
      cbRef.current(payload as T);
    });
    return dispose;
  }, [channel]);
}
