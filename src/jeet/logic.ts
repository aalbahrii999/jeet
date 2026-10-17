import { DAY_PLAN, defById, PLAN_TITLE, PROGRAM_DAYS, slotsFor } from "./plan";
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
  return state.gymDays.includes(date.getDay());
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

const PLAN_ORDER: PlanId[] = ["push", "pull", "legs", "upper", "lower"];

function countBefore(state: JeetState, date: Date): number {
  const start = iso(weekStart(date));
  const key = iso(date);
  return state.sessions.filter((item) => item.date >= start && item.date < key).length;
}

export function planForDate(state: JeetState, date: Date): PlanId {
  const existing = sessionOn(state, date);
  if (existing) return existing.plan;
  return PLAN_ORDER[Math.min(countBefore(state, date), PLAN_ORDER.length - 1)];
}

export function canTrain(state: JeetState, today: Date): boolean {
  if (sessionOn(state, today) || state.draft?.date === iso(today)) return true;
  const target = state.gymDays.length || PLAN_ORDER.length;
  if (weekProgress(state, today) >= target) return false;
  if (isGymDay(state, today)) return true;
  const start = weekStart(today);
  const key = iso(today);
  let scheduled = 0;
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    if (iso(day) >= key) break;
    if (PROGRAM_DAYS.includes(day.getDay())) scheduled += 1;
  }
  return countBefore(state, today) < scheduled;
}

export function repCeiling(label?: string): number | null {
  const nums = label?.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return Math.max(...nums);
}

export function readyToBump(state: JeetState, exerciseId: string, ceiling: number | null): boolean {
  if (!ceiling) return false;
  const recent = sortedSessions(state)
    .filter((session) => session.exercises.some((item) => item.exerciseId === exerciseId))
    .slice(0, 2);
  if (recent.length < 2) return false;
  return recent.every((session) => {
    const log = session.exercises.find((item) => item.exerciseId === exerciseId);
    return Boolean(log && log.sets.length && log.sets.every((set) => (set.reps ?? 0) >= ceiling));
  });
}

export function measuredThisWeek(state: JeetState, today: Date): boolean {
  const start = iso(weekStart(today));
  return state.measures.some((item) => item.date >= start);
}

export function shotThisWeek(state: JeetState, today: Date): boolean {
  const start = iso(weekStart(today));
  return state.bodyShots.some((item) => item.date >= start);
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

function defaultReps(label?: string): number {
  const first = Number(label?.match(/\d+/)?.[0]);
  return first || 10;
}

function blankLog(state: JeetState, def: ReturnType<typeof defById>, today: Date, comeback: boolean): ExerciseLog {
  if (def.kind === "walk") {
    const base = def.walk ?? { minutes: 6, speed: 5, incline: 1 };
    return { exerciseId: def.id, sets: [], walk: { ...base } };
  }
  const kg = suggestKg(state, def.id, today);
  const count = comeback ? Math.min(2, def.sets) : def.sets;
  return {
    exerciseId: def.id,
    sets: Array.from({ length: count }, () => ({ kg, reps: kg ? defaultReps(def.reps) : null })),
  };
}

export function createDraft(state: JeetState, today: Date, kind: SessionKind): Draft {
  const plan = planForDate(state, today);
  const comeback = inComeback(state, today);
  return {
    date: iso(today),
    plan,
    kind,
    step: 0,
    logs: slotsFor(plan, kind).map((slot) => blankLog(state, slot, today, comeback)),
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
      keep_program: "Sun push / Mon pull / Tue legs / Thu upper / Fri lower",
      days_per_week: 5,
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
    "قيود التحليل: لا تغيّر الحصص الخمس ولا أيامها، أجهزة فقط، لا تقترح علاج هرمونات، تعديل واحد فقط.",
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

export function motivation(state: JeetState, today: Date): string {
  const gym = isGymDay(state, today);
  const attended = Boolean(sessionOn(state, today));
  const target = state.gymDays.length || 5;
  const done = Math.min(weekProgress(state, today), target);
  const gap = daysSinceLast(state, today);
  const measured = measuredThisWeek(state, today);
  if (!attended && canTrain(state, today)) {
    const plan = planForDate(state, today);
    if (DAY_PLAN[today.getDay()] !== plan) return `معك ${PLAN_TITLE[plan]}. الترتيب يتبع حضورك.`;
  }
  if (gap === null && gym && !attended) return "أول حضور يفتح السجل. جلسة قصيرة تكفي.";
  if (state.ember && gym && !attended) return "اللهب خافت. حصة اليوم تعيده، ولو كانت قصيرة.";
  if (state.ember && !gym) return "راحة اليوم لا تطفئ اللهب. الأسبوع الجاي يعيده.";
  if (attended && done >= target) return "الأسبوع انغلق بالخمس حصص. الراحة الآن جزء من الخطة.";
  if (attended) return `حضور اليوم محسوب. صار الأسبوع ${done} من ${target}.`;
  if (gym && done === target - 1) return "باقي حصة وتكتمل الخمسة. لا تؤجلها.";
  if (gym && today.getDay() === 5 && (!measured || !shotThisWeek(state, today))) {
    return "اليوم سفلي. بعدها الوزن والخصر وصورة الجسم.";
  }
  if (gym && inComeback(state, today)) return "الرجوع أخف: مجموعتان فقط، ووزن أقل قليلًا.";
  if (gym) return "خمسة أيام ثابتة. اليوم واحد منها.";
  return "الأربعاء والسبت راحة. الراحة تحمي الستريك.";
}

export function attendanceWeeks(state: JeetState, today: Date, count = 8) {
  const start = weekStart(today);
  const rows = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const week = addDays(start, -7 * i);
    const dates = new Set(sessionsInWeek(state, week).map((session) => session.date));
    rows.push({
      start: iso(week),
      label: iso(week).slice(5),
      count: Math.min(dates.size, state.gymDays.length || 5),
    });
  }
  return rows;
}

export type ReportModel = {
  generated: string;
  weekStart: string;
  done: number;
  target: number;
  streak: number;
  ember: boolean;
  comeback: boolean;
  daysSince: number | null;
  gymDays: string[];
  weeks: { start: string; count: number }[];
  measures: {
    date: string;
    waist: number;
    weight: number;
    waistDelta: number | null;
    weightDelta: number | null;
  }[];
  sessions: {
    date: string;
    plan: string;
    kind: string;
    exercises: {
      name: string;
      walk?: { minutes: number; speed: number; incline: number };
      sets: { kg: number | null; reps: number | null }[];
    }[];
  }[];
  lifts: { name: string; last: number | null; prev: number | null }[];
  shots: { date: string; image: string }[];
  weak: boolean;
};

export function reportModel(state: JeetState, today = new Date()): ReportModel {
  const measures = [...state.measures].sort((a, b) => (a.date < b.date ? -1 : 1));
  const sessions = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const liftIds = [
    "chest-press",
    "shoulder-press",
    "pec-deck",
    "lat-pulldown",
    "seated-row",
    "leg-press",
    "leg-ext",
    "leg-curl",
    "calf",
    "hip-abduction",
    "lat-ind",
  ];
  return {
    generated: iso(today),
    weekStart: iso(weekStart(today)),
    done: weekProgress(state, today),
    target: state.gymDays.length,
    streak: state.streak,
    ember: state.ember,
    comeback: inComeback(state, today),
    daysSince: daysSinceLast(state, today),
    gymDays: effectiveDays(state, today).map((day) => DAY_NAMES[day] ?? ""),
    weeks: attendanceWeeks(state, today, 8),
    measures: measures.map((item, index) => {
      const prev = measures[index - 1];
      return {
        date: item.date,
        waist: item.waist,
        weight: item.weight,
        waistDelta: prev ? Math.round((item.waist - prev.waist) * 10) / 10 : null,
        weightDelta: prev ? Math.round((item.weight - prev.weight) * 10) / 10 : null,
      };
    }),
    sessions: sessions.map((session) => ({
      date: session.date,
      plan: session.plan,
      kind: session.kind,
      exercises: session.exercises.map((log) => ({
        name: defById(log.exerciseId).name,
        walk: log.walk,
        sets: log.sets.map((set) => ({ kg: set.kg, reps: set.reps })),
      })),
    })),
    lifts: liftIds.map((id) => {
      const found = sessions.filter((session) => bestKg(session, id) !== null);
      return {
        name: defById(id).name,
        last: found[0] ? bestKg(found[0], id) : null,
        prev: found[1] ? bestKg(found[1], id) : null,
      };
    }),
    shots: [...state.bodyShots].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-8),
    weak: measures.length < 2 || sessions.length < 2,
  };
}
