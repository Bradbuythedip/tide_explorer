"use client";

/**
 * <Toaster /> — in-page toast notifications + opt-in browser
 * Notifications API for new blocks.
 *
 * Listens for the window 'prevblock:new-block' custom event that
 * <RecentBlocks /> dispatches whenever a new block arrives via
 * the WebSocket. We show a brief in-page toast (auto-dismisses in
 * 5s) and — if the user has granted permission — also fire a
 * native browser notification.
 *
 * Browser notifications are strictly opt-in: we never request
 * permission on page load. A small floating button in the bottom
 * right lets the user enable them explicitly. DIRECTIVE.md §1
 * anti-pattern compliance: no push-notifications-by-default.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface Toast {
  id: number;
  title: string;
  detail: string;
}

interface NewBlockDetail {
  height: number;
  hash: string;
  time: number;
  txCount: number;
  totalOutTdc: string;
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifPermission, setNotifPermission] = useState<
    "default" | "granted" | "denied" | "unsupported"
  >("unsupported");
  const nextIdRef = useRef(1);

  // Detect notification support + current permission on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  const pushToast = useCallback((title: string, detail: string) => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev, { id, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5_000);
  }, []);

  // Subscribe to the 'new-block' window event fired by <RecentBlocks />.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent<NewBlockDetail>).detail;
      if (!d) return;
      const title = `New block #${d.height.toLocaleString()}`;
      const detail = `${d.txCount} tx · ${Number(d.totalOutTdc).toLocaleString(
        undefined,
        { maximumFractionDigits: 2 },
      )} TDC`;
      pushToast(title, detail);

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body: detail, icon: "/favicon.svg" });
        } catch {
          /* ignore — some mobile browsers throw without a service worker */
        }
      }
    };
    window.addEventListener("prevblock:new-block", handler);
    return () => window.removeEventListener("prevblock:new-block", handler);
  }, [pushToast]);

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === "granted") {
        pushToast("Notifications enabled", "You'll get a ping on every new block.");
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {/* Toasts */}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-72 rounded-lg border border-surface-3 bg-surface-1 p-4 shadow-2xl"
          >
            <div className="text-sm font-semibold text-slate-100">{t.title}</div>
            <div className="mt-1 text-xs text-slate-400">{t.detail}</div>
          </div>
        ))}
      </div>

      {/* Enable-notifications chip — only shown if unset and supported */}
      {notifPermission === "default" && (
        <button
          type="button"
          onClick={() => void requestNotifPermission()}
          className="fixed bottom-6 left-6 z-40 rounded-full border border-surface-3 bg-surface-1 px-4 py-2 text-xs text-slate-300 shadow-lg hover:border-brand hover:text-slate-100"
        >
          🔔 Enable new-block notifications
        </button>
      )}
    </>
  );
}
