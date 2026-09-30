import { useEffect, useSyncExternalStore } from "react";
import { settle } from "./logic";
import type { Draft, JeetState, Measure, Session } from "./types";
import { APP_VERSION } from "./types";

const KEY = "jeet.v1";

export function defaultState(): JeetState {
  return {
    version: APP_VERSION,
    gymDays: [6, 1, 3],
    reminder: "18:00",
    reminders: true,
    sessions: [],
    measures: [],
    moves: {},
    photos: {},
    streak: 0,
    ember: false,
    lastSettledWeek: null,
    draft: null,
  };
}

const serverState = defaultState();
let state = serverState;
let ready = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function save() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function sanitize(raw: unknown): JeetState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<JeetState>;
  const gymDays = Array.isArray(value.gymDays)
    ? value.gymDays.filter((n) => typeof n === "number" && n >= 0 && n <= 6).slice(0, 3)
    : base.gymDays;
  return {
    ...base,
    ...value,
    version: APP_VERSION,
    gymDays: gymDays.length === 3 ? gymDays : base.gymDays,
    reminder: typeof value.reminder === "string" ? value.reminder : base.reminder,
    reminders: value.reminders !== false,
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    measures: Array.isArray(value.measures) ? value.measures : [],
    moves: value.moves && typeof value.moves === "object" ? value.moves : {},
    photos: value.photos && typeof value.photos === "object" ? value.photos : {},
    streak: typeof value.streak === "number" ? value.streak : 0,
    ember: Boolean(value.ember),
    lastSettledWeek: typeof value.lastSettledWeek === "string" ? value.lastSettledWeek : null,
    draft: value.draft ?? null,
  };
}

export function hydrate() {
  if (ready || typeof localStorage === "undefined") return;
  ready = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = settle(raw ? sanitize(JSON.parse(raw)) : defaultState());
  } catch {
    state = settle(defaultState());
  }
  save();
  emit();
}

export function getState() {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function update(recipe: (current: JeetState) => JeetState) {
  state = recipe(state);
  save();
  emit();
}

export function replaceState(next: JeetState) {
  state = settle({ ...defaultState(), ...next, version: APP_VERSION });
  save();
  emit();
}

export function useJeet() {
  const snapshot = useSyncExternalStore(subscribe, getState, () => serverState);
  const isReady = useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
  useEffect(() => {
    hydrate();
  }, []);
  return { state: snapshot, ready: isReady };
}

export function saveSession(session: Session) {
  update((current) => ({
    ...current,
    draft: null,
    sessions: [...current.sessions.filter((item) => item.date !== session.date), session],
  }));
}

export function setDraft(draft: Draft | null) {
  update((current) => ({ ...current, draft }));
}

export function saveMeasure(measure: Measure) {
  update((current) => ({
    ...current,
    measures: [...current.measures.filter((item) => item.date !== measure.date), measure].sort((a, b) =>
      a.date < b.date ? -1 : 1,
    ),
  }));
}
