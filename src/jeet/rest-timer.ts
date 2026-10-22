import { useEffect, useSyncExternalStore } from "react";
import { androidBridge } from "./native";

export type RestTimer = {
  id: string;
  exerciseKey: string;
  exerciseName: string;
  duration: number;
  endAt: number;
  native: boolean;
  exact: boolean;
};

type Snapshot = { timer: RestTimer | null; now: number; error: string };
const EMPTY: Snapshot = { timer: null, now: 0, error: "" };
const KEY = "jeet.rest.v1";
let snapshot = EMPTY;
let initialized = false;
let interval: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* The browser may block haptics. */ }
}

function publish(timer: RestTimer | null, error = "") {
  snapshot = { timer, now: Date.now(), error };
  try {
    if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
    else localStorage.removeItem(KEY);
  } catch {
    // An active native alarm remains valid even if browser storage is full.
  }
  listeners.forEach((listener) => listener());
  if (interval !== undefined) clearInterval(interval);
  interval = undefined;
  if (timer && timer.endAt > Date.now()) interval = setInterval(tick, 250);
}

function tick() {
  const { timer } = snapshot;
  if (!timer) return;
  const now = Date.now();
  const finished = now >= timer.endAt;
  if (finished && interval !== undefined) {
    clearInterval(interval);
    interval = undefined;
    // Android owns the alert, including while WebView is suspended. Never
    // vibrate again when the screen resumes after the native alarm fired.
    if (!timer.native) vibrate([300, 180, 300, 180, 500]);
  }
  snapshot = { ...snapshot, now };
  listeners.forEach((listener) => listener());
}

function validTimer(value: unknown): value is RestTimer {
  if (!value || typeof value !== "object") return false;
  const timer = value as RestTimer;
  return typeof timer.id === "string" && typeof timer.exerciseKey === "string" &&
    typeof timer.exerciseName === "string" && Number.isFinite(timer.endAt) &&
    Number.isFinite(timer.duration) && timer.duration > 0 && timer.duration <= 600 &&
    typeof timer.native === "boolean" && typeof timer.exact === "boolean";
}

function synchronize() {
  const bridge = androidBridge();
  if (bridge?.restTimerStatus) {
    try {
      const native = JSON.parse(bridge.restTimerStatus());
      if (native === null) publish(null);
      else if (validTimer(native)) publish(native);
      return;
    } catch {
      // Keep the current countdown if the bridge is temporarily unavailable.
    }
  }
  tick();
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    // Do not deliver an old vibration after reopening a browser tab.
    if (validTimer(saved) && saved.endAt > Date.now()) publish(saved);
  } catch {
    // A damaged timer must not affect workout data or prevent a new timer.
  }
  synchronize();
  window.addEventListener("focus", synchronize);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") synchronize();
  });
}

export function useRestTimer() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
  useEffect(initialize, []);
  return { ...state, remaining: state.timer ? Math.max(0, state.timer.endAt - state.now) : 0 };
}

export function startRest(exerciseKey: string, exerciseName: string, seconds: number) {
  initialize();
  if (!Number.isFinite(seconds)) return;
  const duration = Math.max(1, Math.min(600, Math.ceil(seconds)));
  let timer: RestTimer = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    exerciseKey, exerciseName, duration,
    endAt: Date.now() + duration * 1000, native: false, exact: false,
  };
  const bridge = androidBridge();
  if (bridge?.startRestTimer) {
    try {
      const result: unknown = JSON.parse(bridge.startRestTimer(JSON.stringify(timer)));
      if (!validTimer(result) || !result.native) throw new Error("schedule");
      timer = result;
    } catch {
      // Retain the previous timer when scheduling a replacement fails.
      publish(snapshot.timer, "تعذّر بدء تنبيه الراحة. حاول مرة أخرى.");
      return;
    }
  } else {
    // Cancel any previous foreground vibration before starting another rest.
    vibrate(0);
  }
  publish(timer);
}

export function extendRest() {
  const timer = snapshot.timer;
  if (!timer) return;
  const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  startRest(timer.exerciseKey, timer.exerciseName, remaining + 30);
}

export function cancelRest() {
  try {
    androidBridge()?.cancelRestTimer?.();
  } catch {
    publish(snapshot.timer, "تعذّر إلغاء التنبيه. حاول مرة أخرى.");
    return;
  }
  vibrate(0);
  publish(null);
}

export function allowPocketAlert() {
  androidBridge()?.openRestAlarmSettings?.();
}

export function formatRest(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
