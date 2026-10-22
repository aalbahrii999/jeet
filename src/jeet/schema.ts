import { defaultLibrary, defaultPlans, defById, PROGRAM_DAYS } from "./plan";
import { iso, parseDate, weekStart } from "./logic";
import { APP_VERSION, type Draft, type ExerciseDef, type ExerciseLog, type JeetState, type Session, type StrengthSet } from "./types";

type Obj = Record<string, unknown>;
const bad = (field: string): never => { throw new Error(`بيانات غير صالحة: ${field}`); };
function object(value: unknown, field: string): Obj { if (!value || typeof value !== "object" || Array.isArray(value)) return bad(field); return value as Obj; }
function text(value: unknown, field: string, max = 120, empty = false): string { if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) return bad(field); return value.trim(); }
function number(value: unknown, field: string, min = 0, max = 10000): number { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return bad(field); return value; }
function integer(value: unknown, field: string, min: number, max: number) { const n = number(value, field, min, max); return Number.isInteger(n) ? n : bad(field); }
function list(value: unknown, field: string): unknown[] { return Array.isArray(value) ? value : bad(field); }
function date(value: unknown): string { const s = text(value, "التاريخ", 10); if (!/^20\d{2}-\d{2}-\d{2}$/.test(s) || iso(parseDate(s)) !== s) return bad("التاريخ"); return s; }
function image(value: unknown): string { const s = text(value, "الصورة", 10000000); return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s) ? s : bad("الصورة"); }
function time(value: unknown, fallback: string) { if (value === undefined) return fallback; const s = text(value, "الوقت", 5); return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : bad("الوقت"); }

export function validateExercise(raw: unknown): ExerciseDef {
  const x = object(raw, "التمرين"), kind = x.kind;
  if (kind !== "walk" && kind !== "strength") return bad("نوع التمرين");
  const value: ExerciseDef = { id: text(x.id, "معرّف التمرين"), name: text(x.name, "اسم التمرين", 70), kind, image: x.image === undefined ? "" : text(x.image, "صورة الجهاز", 80, true), sets: integer(x.sets, "المجموعات", 1, 10) };
  if (x.reps !== undefined) { value.reps = text(x.reps, "التكرارات", 20); if (!/^\d{1,3}(\s*[–\-]\s*\d{1,3})?$/.test(value.reps)) return bad("التكرارات"); }
  if (x.rest !== undefined) value.rest = integer(x.rest, "الراحة", 0, 600);
  for (const key of ["cue", "equipment", "muscle"] as const) if (x[key] !== undefined) value[key] = text(x[key], key, key === "cue" ? 500 : 50, true);
  if (x.archived === true) value.archived = true;
  if (kind === "walk") {
    const w = object(x.walk ?? { minutes: 6, speed: 5, incline: 1 }, "الكارديو");
    value.walk = { minutes: number(w.minutes, "الدقائق", 0, 240), speed: number(w.speed, "السرعة", 0, 100), incline: number(w.incline, "الميل", 0, 50) };
  }
  return value;
}
function decodeSet(raw: unknown): StrengthSet {
  const x = object(raw, "المجموعة");
  return { kg: x.kg === null ? null : number(x.kg, "الوزن", 0, 2000), reps: x.reps === null ? null : integer(x.reps, "التكرارات", 0, 1000), ...(typeof x.done === "boolean" ? { done: x.done } : {}) };
}
function decodeLog(raw: unknown): ExerciseLog {
  const x = object(raw, "سجل التمرين");
  const log: ExerciseLog = { exerciseId: text(x.exerciseId, "معرّف التمرين"), sets: list(x.sets, "المجموعات").map(decodeSet) };
  if (x.definition !== undefined) { log.definition = validateExercise(x.definition); if (log.definition.id !== log.exerciseId) return bad("هوية التمرين"); }
  if (typeof x.completed === "boolean") log.completed = x.completed;
  if (x.walk) { const w = object(x.walk, "الكارديو"); log.walk = { minutes: number(w.minutes, "الدقائق", 0, 240), speed: number(w.speed, "السرعة", 0, 100), incline: number(w.incline, "الميل", 0, 50) }; }
  return log;
}
function decodeSession(raw: unknown): Session {
  const x = object(raw, "الحصة");
  if (x.kind !== "full" && x.kind !== "min") return bad("نوع الحصة");
  const session: Session = { id: text(x.id, "الحصة"), date: date(x.date), plan: text(x.plan, "الجدول"), kind: x.kind, exercises: list(x.exercises, "التمارين").map(decodeLog) };
  if (x.planName !== undefined) session.planName = text(x.planName, "اسم الجدول", 70);
  if (x.durationMinutes !== undefined) session.durationMinutes = number(x.durationMinutes, "مدة الحصة", 0, 1440);
  if (typeof x.comeback === "boolean") session.comeback = x.comeback;
  return session;
}
function unique<T extends { id: string }>(items: T[], field: string) { if (new Set(items.map((item) => item.id)).size !== items.length) return bad(field); return items; }

export function defaultState(): JeetState {
  return { schemaVersion: 2, version: APP_VERSION, plans: defaultPlans(), library: defaultLibrary(), weekTargets: {}, autoRest: true, gymDays: [...PROGRAM_DAYS], reminder: "18:00", measureTime: "09:00", reminders: true, sessions: [], measures: [], bodyShots: [], moves: {}, photos: {}, streak: 0, ember: false, lastSettledWeek: null, draft: null };
}

export function validateState(raw: unknown): JeetState {
  let x = object(raw, "النسخة الاحتياطية");
  if (x.app !== undefined) { if (x.app !== "jeet" || x.schemaVersion !== 2) return bad("إصدار النسخة"); x = object(x.data, "النسخة"); }
  if (typeof x.version !== "string" || !Array.isArray(x.sessions) || !Array.isArray(x.measures) || !Array.isArray(x.gymDays)) return bad("الملف ليس نسخة جيت");
  if (x.schemaVersion !== undefined && x.schemaVersion !== 2) return bad("إصدار البيانات");
  const base = defaultState(), legacy = x.schemaVersion !== 2;
  const gymDays = [...new Set(x.gymDays.map((day) => integer(day, "أيام التدريب", 0, 6)))].sort((a, b) => a - b);
  if (!gymDays.length) return bad("اختر يوم تدريب واحدًا على الأقل");
  const plans = x.plans === undefined ? base.plans : unique(list(x.plans, "الجداول").map((rawPlan) => {
    const p = object(rawPlan, "الجدول");
    const exercises = unique(list(p.exercises, "تمارين الجدول").map(validateExercise), "تمرين مكرر في الجدول");
    if (!exercises.length || exercises.length > 25) return bad("عدد التمارين");
    return { id: text(p.id, "معرّف الجدول"), name: text(p.name, "اسم الجدول", 70), description: text(p.description ?? "", "وصف الجدول", 160, true), exercises };
  }), "جدول مكرر");
  if (!plans.length || plans.length > 14) return bad("عدد الجداول");
  const library = x.library === undefined ? base.library : unique(list(x.library, "مكتبة التمارين").map(validateExercise), "تمرين مكرر");
  if (library.length > 500) return bad("حجم مكتبة التمارين");
  const sessions = list(x.sessions, "الحضور").map(decodeSession);
  // Snapshot legacy labels so later library changes never rename the past.
  for (const session of sessions) for (const log of session.exercises) if (!log.definition) log.definition = { ...defById(log.exerciseId), sets: Math.max(1, Math.min(10, log.sets.length || 1)) };
  const weekTargets: Record<string, number> = {};
  if (x.weekTargets !== undefined) for (const [key, target] of Object.entries(object(x.weekTargets, "أهداف الأسابيع"))) weekTargets[date(key)] = integer(target, "هدف الأسبوع", 1, 7);
  for (const session of sessions) weekTargets[iso(weekStart(parseDate(session.date)))] ??= gymDays.length;
  const photos: Record<string, string> = {};
  if (x.photos !== undefined) for (const [key, value] of Object.entries(object(x.photos, "صور الأجهزة"))) photos[text(key, "الجهاز")] = image(value);
  let draft: Draft | null = null;
  if (x.draft !== undefined && x.draft !== null) {
    const d = object(x.draft, "الحصة غير المكتملة"), logs = list(d.logs, "التمارين").map(decodeLog);
    if (!logs.length || logs.length > 25 || (d.kind !== "full" && d.kind !== "min")) return bad("الحصة غير المكتملة");
    draft = { date: date(d.date), plan: text(d.plan, "الجدول"), kind: d.kind, step: integer(d.step, "خطوة الحصة", 0, logs.length - 1), logs };
    if (d.planName !== undefined) draft.planName = text(d.planName, "اسم الجدول", 70);
    if (d.startedAt !== undefined) draft.startedAt = number(d.startedAt, "بداية الحصة", 0, 5000000000000);
    if (typeof d.comeback === "boolean") draft.comeback = d.comeback;
  }
  const earliest = sessions.map((item) => item.date).sort()[0];
  return {
    ...base, plans, library, gymDays, weekTargets, photos, draft, autoRest: x.autoRest !== false,
    reminder: time(x.reminder, base.reminder), measureTime: time(x.measureTime, base.measureTime), reminders: x.reminders !== false,
    sessions: [...new Map(sessions.map((item) => [item.date, item])).values()],
    measures: list(x.measures, "القياسات").map((rawMeasure) => { const m = object(rawMeasure, "القياس"); return { date: date(m.date), waist: number(m.waist, "الخصر", 1, 400), weight: number(m.weight, "الوزن", 1, 600) }; }).sort((a, b) => a.date.localeCompare(b.date)),
    bodyShots: list(x.bodyShots ?? [], "صور الجسم").map((rawShot) => { const shot = object(rawShot, "الصورة"); return { date: date(shot.date), image: image(shot.image) }; }),
    streak: legacy ? 0 : integer(x.streak ?? 0, "الاستمرارية", 0, 10000), ember: legacy ? false : Boolean(x.ember),
    lastSettledWeek: legacy ? (earliest ? iso(weekStart(parseDate(earliest))) : null) : x.lastSettledWeek ? date(x.lastSettledWeek) : null,
  };
}

export function backupDocument(state: JeetState) { return { app: "jeet", schemaVersion: 2, exportedAt: new Date().toISOString(), data: state }; }
