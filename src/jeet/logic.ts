import { defById, planTitle, slotsFor } from "./plan";
import type { Draft, ExerciseDef, ExerciseLog, JeetState, PlanId, Session, SessionKind } from "./types";
import { APP_VERSION } from "./types";

export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export function iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function parseDate(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function addDays(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
export function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function weekStart(d: Date): Date { return addDays(startOfDay(d), -d.getDay()); }
export function effectiveDays(state: JeetState, _date: Date): number[] { return state.gymDays; }
export function isGymDay(state: JeetState, date: Date): boolean { return state.gymDays.includes(date.getDay()); }
export function sessionsInWeek(state: JeetState, start: Date): Session[] {
  const from = iso(start), to = iso(addDays(start, 6));
  return state.sessions.filter((item) => item.date >= from && item.date <= to);
}
export function targetForWeek(state: JeetState, start: Date): number { return state.weekTargets[iso(weekStart(start))] ?? state.gymDays.length; }
export function weekHitTarget(state: JeetState, start: Date): boolean { return new Set(sessionsInWeek(state, start).map((item) => item.date)).size >= targetForWeek(state, start); }
export function weekProgress(state: JeetState, today: Date): number { return new Set(sessionsInWeek(state, weekStart(today)).filter((item) => item.date <= iso(today)).map((item) => item.date)).size; }
export function settle(state: JeetState, today = new Date()): JeetState {
  const current = weekStart(today);
  if (!state.lastSettledWeek) return { ...state, lastSettledWeek: iso(current) };
  let cursor = parseDate(state.lastSettledWeek), streak = state.streak, ember = state.ember;
  if (!Number.isFinite(cursor.getTime()) || cursor > current) return { ...state, lastSettledWeek: iso(current) };
  if (iso(cursor) === iso(current)) return state;
  while (addDays(cursor, 7) <= current) {
    if (weekHitTarget(state, cursor)) { streak += 1; ember = false; }
    else if (ember) streak = 0;
    else ember = true;
    cursor = addDays(cursor, 7);
  }
  return { ...state, streak, ember, lastSettledWeek: iso(cursor) };
}
export function sortedSessions(state: JeetState): Session[] { return [...state.sessions].sort((a, b) => b.date.localeCompare(a.date)); }
export function daysSinceLast(state: JeetState, today: Date): number | null {
  const last = sortedSessions(state).find((item) => item.date <= iso(today));
  return last ? Math.max(0, Math.round((startOfDay(today).getTime() - parseDate(last.date).getTime()) / 86400000)) : null;
}
export function inComeback(state: JeetState, today: Date): boolean { const gap = daysSinceLast(state, today); return state.ember || (gap !== null && gap >= 7); }
export function sessionOn(state: JeetState, date: Date): Session | undefined { return state.sessions.find((item) => item.date === iso(date)); }
export function planForDate(state: JeetState, date: Date): PlanId {
  const existing = sessionOn(state, date);
  if (existing) return existing.plan;
  const previous = sortedSessions(state).find((item) => item.date < iso(date));
  const aliases: Record<string, string> = { A: "push", B: "pull", C: "legs" };
  const index = state.plans.findIndex((plan) => plan.id === (previous ? aliases[previous.plan] ?? previous.plan : ""));
  return state.plans[(index + 1) % state.plans.length]?.id ?? "push";
}
export function canTrain(state: JeetState, today: Date): boolean {
  if (sessionOn(state, today) || state.draft) return true;
  if (weekProgress(state, today) >= targetForWeek(state, today)) return false;
  if (isGymDay(state, today)) return true;
  return weekProgress(state, today) < state.gymDays.filter((day) => day < today.getDay()).length;
}
export function repCeiling(label?: string): number | null { const values = label?.match(/\d+/g)?.map(Number) ?? []; return values.length ? Math.max(...values) : null; }
export function readyToBump(state: JeetState, exerciseId: string, ceiling: number | null): boolean {
  if (!ceiling) return false;
  const recent = sortedSessions(state).filter((session) => session.exercises.some((log) => log.exerciseId === exerciseId)).slice(0, 2);
  if (recent.length < 2) return false;
  const sets = recent.map((session) => session.exercises.find((log) => log.exerciseId === exerciseId)!.sets.filter((set) => set.done !== false));
  return sets.every((group, index) => group.length >= (recent[index].exercises.find((log) => log.exerciseId === exerciseId)?.definition?.sets ?? 2) && group.every((set) => (set.reps ?? 0) >= ceiling && (set.kg ?? 0) > 0)) && new Set(sets.flat().map((set) => set.kg)).size === 1;
}
export function measuredThisWeek(state: JeetState, today: Date): boolean { const from = iso(weekStart(today)), to = iso(today); return state.measures.some((item) => item.date >= from && item.date <= to); }
export function shotThisWeek(state: JeetState, today: Date): boolean { const from = iso(weekStart(today)), to = iso(today); return state.bodyShots.some((item) => item.date >= from && item.date <= to); }
export function suggestKg(state: JeetState, exerciseId: string, today: Date): number | null {
  const comeback = inComeback(state, today), sessions = sortedSessions(state).filter((session) => session.date <= iso(today));
  const candidates = comeback ? sessions.filter((session) => !session.comeback) : sessions;
  for (const session of candidates) {
    const kg = session.exercises.find((item) => item.exerciseId === exerciseId)?.sets.filter((set) => set.done !== false && set.kg !== null).at(-1)?.kg;
    if (kg === undefined || kg === null) continue;
    if (!comeback) return kg;
    const step = kg < 10 ? 0.5 : kg < 25 ? 1 : 2.5;
    return Math.min(kg, Math.max(0, Math.floor(kg * 0.85 / step) * step));
  }
  return null;
}
function blankLog(state: JeetState, def: ExerciseDef, today: Date, comeback: boolean): ExerciseLog {
  const definition = { ...def, walk: def.walk ? { ...def.walk } : undefined };
  if (def.kind === "walk") return { exerciseId: def.id, definition, sets: [], completed: false, walk: { ...(def.walk ?? { minutes: 6, speed: 5, incline: 1 }) } };
  return { exerciseId: def.id, definition, sets: Array.from({ length: comeback ? Math.min(2, def.sets) : def.sets }, () => ({ kg: suggestKg(state, def.id, today), reps: null, done: false })) };
}
export function createDraft(state: JeetState, today: Date, kind: SessionKind, selectedPlan?: string): Draft {
  const plan = selectedPlan ?? planForDate(state, today), comeback = inComeback(state, today);
  return { date: iso(today), plan, planName: planTitle(state, plan), kind, step: 0, startedAt: Date.now(), comeback, logs: slotsFor(plan, kind, state).map((def) => blankLog(state, def, today, comeback)) };
}
export function draftFromSession(session: Session): Draft {
  return { date: session.date, plan: session.plan, planName: session.planName, kind: session.kind, step: 0, comeback: session.comeback, logs: session.exercises.map((log) => ({ ...log, completed: true, sets: log.sets.map((set) => ({ ...set, done: set.done !== false })) })) };
}
export function weekdayChips(today: Date): Date[] { return Array.from({ length: 7 }, (_, i) => addDays(weekStart(today), i)); }
export function asset(path: string): string { const clean = path.replace(/^\//, ""); return typeof window !== "undefined" && window.location.protocol === "file:" ? clean : `/${clean}`; }
export function motivation(state: JeetState, today: Date): string {
  if (sessionOn(state, today)) return "كل حصة تبني اللي بعدها. أحسنت اليوم.";
  if (state.draft) return "خطوة واحدة وتكمل ما بدأت. حصتك محفوظة.";
  if (inComeback(state, today)) return "ارجع بهدوء. الاستمرار أهم من الوزن.";
  return canTrain(state, today) ? "مو لازم تكون جاهز تمامًا. ابدأ، والباقي يجي." : "الراحة جزء من تقدمك. خذ يومك براحة.";
}
export function attendanceWeeks(state: JeetState, today: Date, count = 8) {
  return Array.from({ length: count }, (_, i) => { const start = addDays(weekStart(today), -7 * (count - i - 1)); return { start: iso(start), label: iso(start).slice(5), count: new Set(sessionsInWeek(state, start).map((item) => item.date)).size, target: targetForWeek(state, start) }; });
}
function bestKg(session: Session, id: string): number | null {
  const weights = session.exercises.find((log) => log.exerciseId === id)?.sets.filter((set) => set.done !== false).map((set) => set.kg).filter((kg): kg is number => kg !== null && kg > 0) ?? [];
  return weights.length ? Math.max(...weights) : null;
}
export type ReportModel = {
  generated: string; weekStart: string; done: number; target: number; streak: number; ember: boolean; comeback: boolean; daysSince: number | null; gymDays: string[];
  weeks: { start: string; count: number }[];
  measures: { date: string; waist: number; weight: number; waistDelta: number | null; weightDelta: number | null }[];
  sessions: { date: string; plan: string; kind: string; exercises: { name: string; walk?: { minutes: number; speed: number; incline: number }; sets: { kg: number | null; reps: number | null }[] }[] }[];
  lifts: { name: string; last: number | null; prev: number | null }[]; shots: { date: string; image: string }[]; weak: boolean;
};
export function reportModel(state: JeetState, today = new Date()): ReportModel {
  const measures = [...state.measures].sort((a, b) => a.date.localeCompare(b.date)), sessions = sortedSessions(state);
  const ids = [...new Set(sessions.flatMap((session) => session.exercises.filter((log) => !log.walk).map((log) => log.exerciseId)))];
  const name = (id: string) => sessions.flatMap((session) => session.exercises).find((log) => log.exerciseId === id)?.definition?.name ?? defById(id, state).name;
  return {
    generated: iso(today), weekStart: iso(weekStart(today)), done: weekProgress(state, today), target: targetForWeek(state, today), streak: state.streak, ember: state.ember, comeback: inComeback(state, today), daysSince: daysSinceLast(state, today), gymDays: state.gymDays.map((day) => DAY_NAMES[day]), weeks: attendanceWeeks(state, today),
    measures: measures.map((item, index) => ({ ...item, waistDelta: index ? Math.round((item.waist - measures[index - 1].waist) * 10) / 10 : null, weightDelta: index ? Math.round((item.weight - measures[index - 1].weight) * 10) / 10 : null })),
    sessions: sessions.map((session) => ({ date: session.date, plan: session.planName ?? planTitle(state, session.plan), kind: session.kind, exercises: session.exercises.map((log) => ({ name: log.definition?.name ?? defById(log.exerciseId, state).name, walk: log.walk, sets: log.sets.filter((set) => set.done !== false).map((set) => ({ kg: set.kg, reps: set.reps })) })) })),
    lifts: ids.map((id) => { const found = sessions.filter((session) => bestKg(session, id) !== null); return { name: name(id), last: found[0] ? bestKg(found[0], id) : null, prev: found[1] ? bestKg(found[1], id) : null }; }),
    shots: [...state.bodyShots].sort((a, b) => a.date.localeCompare(b.date)), weak: measures.length < 2 || sessions.filter((session) => session.exercises.some((log) => log.sets.some((set) => set.kg !== null && set.reps !== null))).length < 2,
  };
}
export function buildReport(state: JeetState, today = new Date()): { text: string; json: string } { const model = reportModel(state, today), json = JSON.stringify({ app: "jeet", version: APP_VERSION, ...model }, null, 2); return { json, text: `تقرير جيت ${APP_VERSION}\nالحضور: ${model.done}/${model.target}\n${json}` }; }
