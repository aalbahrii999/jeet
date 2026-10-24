import { useEffect, useSyncExternalStore } from "react";
import { iso, parseDate, settle, weekStart } from "./logic";
import { defaultState, validateState } from "./schema";
import { initialBackup } from "./initial-data";
import type { BodyShot, Draft, JeetState, Measure, Session } from "./types";
export { defaultState } from "./schema";

const KEY = "jeet.v1";
const serverState = defaultState();
let state = serverState;
let ready = false;
let error = "";
let damaged: string | null = null;
let unreadable = false;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((listener) => listener()); }
export function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function getState() { return state; }
export function getRecoveryData() { return damaged; }
export function hydrate() {
  if (ready || typeof localStorage === "undefined") return;
  ready = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    const packaged = raw === null ? initialBackup() : null;
    state = settle(raw !== null ? validateState(JSON.parse(raw)) : packaged ? validateState(JSON.parse(packaged)) : defaultState());
    // A personal APK seeds only an absent store. Existing, reset or damaged data wins.
    if (raw === null && packaged) localStorage.setItem(KEY, JSON.stringify(state));
    // Read and migrate in memory. Never overwrite an unreadable original.
  } catch {
    damaged = raw;
    unreadable = true;
    error = "تعذّر فتح البيانات المحفوظة. احتفظ بنسخة استرداد من الإعدادات قبل استبدالها.";
    state = defaultState();
  }
  emit();
}
export function update(recipe: (current: JeetState) => JeetState): boolean {
  if (unreadable) { error = "استعد بياناتك أو صدّر نسخة الاسترداد من الإعدادات أولًا."; emit(); return false; }
  const next = settle(recipe(settle(state)));
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    error = "";
    emit();
    return true;
  } catch {
    error = "لم يُحفظ التغيير. قد تكون مساحة التخزين ممتلئة؛ صدّر نسخة احتياطية وأزل صورًا لا تحتاجها.";
    emit();
    return false;
  }
}
export function replaceState(raw: unknown): boolean {
  const next = settle(validateState(raw));
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { error = "لا توجد مساحة كافية لاستيراد النسخة. بياناتك الحالية لم تتغير."; emit(); return false; }
  state = next; damaged = null; unreadable = false; error = ""; emit(); return true;
}
export function resetState(): boolean { return replaceState(defaultState()); }
export function refreshWeek() {
  const next = settle(state);
  if (next !== state && !unreadable) update(() => next);
}
export function useJeet() {
  const snapshot = useSyncExternalStore(subscribe, getState, () => serverState);
  const isReady = useSyncExternalStore(subscribe, () => ready, () => false);
  const message = useSyncExternalStore(subscribe, () => error, () => "");
  useEffect(hydrate, []);
  return { state: snapshot, ready: isReady, error: message };
}
export function saveSession(session: Session) {
  return update((current) => ({ ...current, draft: null,
    ...(current.lastSettledWeek && session.date < current.lastSettledWeek ? { streak: 0, ember: false, lastSettledWeek: iso(weekStart(parseDate([...current.sessions.map((item) => item.date), session.date].sort()[0]))) } : {}),
    weekTargets: { ...current.weekTargets, [iso(weekStart(parseDate(session.date)))]: current.weekTargets[iso(weekStart(parseDate(session.date)))] ?? current.gymDays.length },
    sessions: [...current.sessions.filter((item) => item.date !== session.date), session],
  }));
}
export function deleteToday(date: string) { return update((current) => ({ ...current, draft: current.draft?.date === date ? null : current.draft, sessions: current.sessions.filter((item) => item.date !== date) })); }
export function setDraft(draft: Draft | null) { return update((current) => ({ ...current, draft })); }
export function saveMeasure(measure: Measure) { return update((current) => ({ ...current, measures: [...current.measures.filter((item) => item.date !== measure.date), measure].sort((a, b) => a.date.localeCompare(b.date)) })); }
export function saveBodyShot(shot: BodyShot) { return update((current) => ({ ...current, bodyShots: [...current.bodyShots.filter((item) => item.date !== shot.date), shot].sort((a, b) => a.date.localeCompare(b.date)) })); }
