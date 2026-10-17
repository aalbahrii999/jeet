import { useEffect, useSyncExternalStore } from "react";
import { settle } from "./logic";
import { PROGRAM_DAYS } from "./plan";
import type { BodyShot, Draft, JeetState, Measure, Session } from "./types";
import { APP_VERSION } from "./types";

const KEY = "jeet.v1";

export function defaultState(): JeetState {
  return {
    version: APP_VERSION,
    gymDays: [...PROGRAM_DAYS],
    reminder: "18:00",
    measureTime: "09:00",
    reminders: true,
    sessions: [],
    measures: [],
    bodyShots: [],
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
  return {
    ...base,
    ...value,
    version: APP_VERSION,
    gymDays: [...PROGRAM_DAYS],
    reminder: typeof value.reminder === "string" ? value.reminder : base.reminder,
    measureTime: typeof value.measureTime === "string" ? value.measureTime : base.measureTime,
    reminders: value.reminders !== false,
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    measures: Array.isArray(value.measures) ? value.measures : [],
    bodyShots: Array.isArray(value.bodyShots)
      ? value.bodyShots
          .filter(
            (item): item is BodyShot =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as BodyShot).date === "string" &&
              typeof (item as BodyShot).image === "string",
          )
          .slice(-30)
      : [],
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
  state = settle(sanitize(next));
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

export function deleteToday(date: string) {
  update((current) => ({
    ...current,
    draft: current.draft?.date === date ? null : current.draft,
    sessions: current.sessions.filter((item) => item.date !== date),
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

export function saveBodyShot(shot: BodyShot) {
  update((current) => ({
    ...current,
    bodyShots: [...current.bodyShots.filter((item) => item.date !== shot.date), shot]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-30),
  }));
}
