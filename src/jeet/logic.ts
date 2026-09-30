import { defById, exerciseIds } from "./plan";
import type { Draft, ExerciseLog, JeetState, PlanId, Session, SessionKind } from "./types";
import { APP_VERSION } from "./types";

export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function weekStart(d: Date): Date {
  const x = startOfDay(d);
  const sinceSat = (x.getDay() + 1) % 7;
  return addDays(x, -sinceSat);
}

export function effectiveDays(state: JeetState, anyDay: Date): number[] {
  const key = iso(weekStart(anyDay));
  const map = state.moves[key] ?? {};
  const days = state.gymDays.map((dow) => {
    const moved = map[String(dow)];
    return typeof moved === "number" ? moved : dow;
  });
  return [...new Set(days)];
}

export function isGymDay(state: JeetState, date: Date): boolean {
  return effectiveDays(state, date).includes(date.getDay());
}

export function sessionsInWeek(state: JeetState, start: Date): Session[] {
  const from = iso(start);
  const to = iso(addDays(start, 6));
  return state.sessions.filter((s) => s.date >= from && s.date <= to);
}

export function weekHitTarget(state: JeetState, start: Date): boolean {
  const dates = new Set(sessionsInWeek(state, start).map((s) => s.date));
  return dates.size >= state.gymDays.length;
}

export function weekProgress(state: JeetState, today: Date): number {
  return new Set(sessionsInWeek(state, weekStart(today)).map((s) => s.date)).size;
}

export function settle(state: JeetState, today = new Date()): JeetState {
  const current = weekStart(today);
  if (!state.lastSettledWeek) return { ...state, lastSettledWeek: iso(current) };
  let cursor = parseDate(state.lastSettledWeek);
  let streak = state.streak;
  let ember = state.ember;
  let changed = false;
  while (addDays(cursor, 7).getTime() <= current.getTime()) {
    const ok = weekHitTarget(state, cursor);
    if (ok) {
      streak += 1;
      ember = false;
    } else if (ember) {
      streak = 0;
    } else {
      ember = true;
    }
    cursor = addDays(cursor, 7);
    changed = true;
  }
  if (!changed) return state;
  return { ...state, streak, ember, lastSettledWeek: iso(cursor) };
}

export function sortedSessions(state: JeetState): Session[] {
  return [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function daysSinceLast(state: JeetState, today: Date): number | null {
  const last = sortedSessions(state)[0];
  if (!last) return null;
  const diff = startOfDay(today).getTime() - parseDate(last.date).getTime();
  return Math.round(diff / 86400000);
}

export function inComeback(state: JeetState, today: Date): boolean {
  const gap = daysSinceLast(state, today);
  return state.ember || (gap !== null && gap >= 7);
}

export function sessionOn(state: JeetState, date: Date): Session | undefined {
  const key = iso(date);
  return state.sessions.find((s) => s.date === key);
}

export function planForNewSession(state: JeetState, today: Date): PlanId {
  const n = sessionsInWeek(state, weekStart(today)).length;
  return (["A", "B", "C"] as const)[n % 3];
}

export function suggestKg(state: JeetState, exerciseId: string, today: Date): number | null {
  for (const session of sortedSessions(state)) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.kg));
    if (!log) continue;
    const kg = [...log.sets].reverse().find((s) => s.kg)?.kg;
    if (!kg) continue;
    if (inComeback(state, today)) return Math.max(5, Math.round((kg * 0.85) / 5) * 5);
    return kg;
  }
  return null;
}

function blankLog(state: JeetState, id: string, today: Date, kind: SessionKind): ExerciseLog {
  const def = defById(id);
  if (def.kind === "walk") {
    const base = def.walk ?? { minutes: 10, speed: 5, incline: 1 };
    const minutes = kind === "min" && id.startsWith("walk-out") ? 10 : base.minutes;
    return { exerciseId: id, sets: [], walk: { ...base, minutes } };
  }
  const kg = suggestKg(state, id, today);
  return {
    exerciseId: id,
    sets: Array.from({ length: def.sets }, () => ({ kg, reps: kg ? 10 : null })),
  };
}

export function createDraft(state: JeetState, today: Date, kind: SessionKind): Draft {
  const plan = planForNewSession(state, today);
  const ids = exerciseIds(plan, kind);
  return {
    date: iso(today),
    plan,
    kind,
    step: 0,
    logs: ids.map((id) => blankLog(state, id, today, kind)),
  };
}

export function draftFromSession(session: Session): Draft {
  return {
    date: session.date,
    plan: session.plan,
    kind: session.kind,
    step: 0,
    logs: session.exercises,
  };
}

export function moveGymDay(state: JeetState, fromDate: Date, toDow: number): JeetState {
  const from = fromDate.getDay();
  const key = iso(weekStart(fromDate));
  const map = { ...(state.moves[key] ?? {}) };
  const origin = state.gymDays.find((d) => (map[String(d)] ?? d) === from);
  if (origin === undefined) return state;
  const other = state.gymDays.find((d) => d !== origin && (map[String(d)] ?? d) === toDow);
  map[String(origin)] = toDow;
  if (other !== undefined) map[String(other)] = from;
  return { ...state, moves: { ...state.moves, [key]: map } };
}

export function weekdayChips(today: Date): Date[] {
  const start = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

type LiftRow = { name: string; now: string; previous: string; trend: "up" | "down" | "same" | "new" };

function bestKg(session: Session, id: string): number | null {
  const log = session.exercises.find((e) => e.exerciseId === id);
  if (!log) return null;
  const vals = log.sets.map((s) => s.kg).filter((n): n is number => typeof n === "number" && n > 0);
  if (!vals.length) return null;
  return Math.max(...vals);
}

export function buildReport(state: JeetState, today = new Date()): { text: string; json: string } {
  const start = weekStart(today);
  const done = weekProgress(state, today);
  const measures = [...state.measures].sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastM = measures.at(-1);
  const prevM = measures.length > 1 ? measures[measures.length - 2] : undefined;
  const fourWeeksAgo = iso(addDays(startOfDay(today), -28));
  const ids = ["chest-press", "lat-pulldown", "seated-row", "leg-press", "shoulder-press"];
  const lifts: LiftRow[] = ids.map((id) => {
    const name = defById(id).name;
    const recent = sortedSessions(state).find((s) => bestKg(s, id));
    const older = sortedSessions(state).find((s) => s.date <= fourWeeksAgo && bestKg(s, id));
    const nowKg = recent ? bestKg(recent, id) : null;
    const prevKg = older ? bestKg(older, id) : null;
    const trend = !nowKg ? "new" : !prevKg || prevKg === nowKg ? "same" : prevKg < nowKg ? "up" : "down";
    return {
      name,
      now: nowKg ? `${nowKg}` : "—",
      previous: prevKg ? `${prevKg}` : "—",
      trend,
    };
  });
  const loggedSets = state.sessions.reduce(
    (n, s) => n + s.exercises.filter((e) => e.sets.some((x) => x.kg)).length,
    0,
  );
  const payload = {
    app: "jeet",
    version: APP_VERSION,
    generated: iso(today),
    attendance: {
      weekly_target: state.gymDays.length,
      this_week: done,
      streak_weeks: state.streak,
      ember: state.ember,
      mode: inComeback(state, today) ? "comeback" : "normal",
      days_since_last: daysSinceLast(state, today),
    },
    lifts,
    body: {
      waist_cm: lastM?.waist ?? null,
      waist_previous: prevM?.waist ?? null,
      weight_kg: lastM?.weight ?? null,
      weight_previous: prevM?.weight ?? null,
      measures_count: measures.length,
    },
    data_quality: {
      sessions: state.sessions.length,
      exercises_with_weight: loggedSets,
      measures: measures.length,
    },
    constraints: {
      keep_program: "A/B/C",
      days_per_week: 3,
      machines_only: true,
      include_walk: true,
      no_new_split: true,
      no_hormone_advice: true,
      one_change_only: true,
    },
  };
  const trendAr = { up: "أعلى", down: "أقل", same: "ثابت", new: "بدون سجل" };
  const lines = [
    `تقرير جيت ${APP_VERSION}`,
    `الأسبوع الذي يبدأ ${iso(start)}`,
    `الحضور: ${done} من ${state.gymDays.length}`,
    `ستريك الأسابيع: ${state.streak}${state.ember ? " (خافت)" : ""}`,
    `الوضع: ${inComeback(state, today) ? "رجوع" : "عادي"}`,
    lastM ? `الخصر: ${lastM.waist} سم${prevM ? ` (قبله ${prevM.waist})` : ""}` : "الخصر: غير مسجّل",
    lastM ? `الوزن: ${lastM.weight} كغ` : "الوزن: غير مسجّل",
    "الأجهزة:",
    ...lifts.map((l) => `- ${l.name}: الآن ${l.now} / قبل 4 أسابيع ${l.previous} / ${trendAr[l.trend]}`),
    "قيود التحليل: لا تغيّر عدد الأيام عن 3، لا تستبدل جدول A/B/C، لا تقترح علاج هرمونات، تعديل واحد فقط.",
    measures.length < 2 || state.sessions.length < 2
      ? "جودة البيانات ضعيفة. إذا نقص القياس أو الأوزان قل ذلك ولا تخترع تقدماً."
      : "جودة البيانات كافية لمقارنة قصيرة.",
    "",
    JSON.stringify(payload, null, 2),
  ];
  return { text: lines.join("\n"), json: JSON.stringify(payload, null, 2) };
}

export function asset(path: string): string {
  const clean = path.replace(/^\//, "");
  if (typeof window !== "undefined" && window.location.protocol === "file:") return clean;
  return `/${clean}`;
}
