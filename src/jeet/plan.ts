import type { ExerciseDef, JeetState, PlanId, SessionKind, WorkoutPlan } from "./types";

export const PROGRAM_DAYS = [0, 1, 2, 4, 5];

export const DAY_PLAN: Partial<Record<number, PlanId>> = {
  0: "push",
  1: "pull",
  2: "legs",
  4: "upper",
  5: "lower",
};

const walkIn: ExerciseDef = {
  id: "walk-in",
  name: "مشي إحماء",
  kind: "walk",
  image: "treadmill",
  sets: 1,
  cue: "٥ إلى ٧ دقائق، ثم مجموعة خفيفة على أول جهاز. الإحماء لا يدخل في العدد المكتوب.",
  walk: { minutes: 6, speed: 5, incline: 1 },
};

function walkOut(minutes: number): ExerciseDef {
  return {
    id: "walk-out",
    name: "مشي اختياري",
    kind: "walk",
    image: "treadmill",
    sets: 1,
    cue: "إذا أنهيت مبكرًا. يمكن تخطيه.",
    walk: { minutes, speed: 5, incline: 1 },
  };
}

function lift(
  id: string,
  name: string,
  image: string,
  sets: number,
  reps: string,
  rest: number,
  cue: string,
): ExerciseDef {
  return { id, name, kind: "strength", image, sets, reps, rest, cue };
}

const chest = (sets: number, rest: number, cue: string) =>
  lift("chest-press", "ضغط الصدر", "chest-press", sets, "8–12", rest, cue);
const fly = (sets: number, rest: number, cue: string) =>
  lift("pec-deck", "فراشة الصدر", "pec-deck", sets, "10–15", rest, cue);
const shoulder = (sets: number, rest: number, cue: string) =>
  lift("shoulder-press", "ضغط الكتف", "shoulder-press", sets, "8–12", rest, cue);
const tri = (sets: number, rest: number, cue: string) =>
  lift("triceps", "ترايسِبس بالجهاز", "triceps", sets, "10–15", rest, cue);
const latBar = (sets: number, rest: number, cue: string) =>
  lift("lat-pulldown", "سحب علوي بالبار", "lat-pulldown", sets, "8–12", rest, cue);
const latInd = (sets: number, rest: number, cue: string) =>
  lift("lat-ind", "سحب علوي بذراعين منفصلتين", "lat-ind", sets, "10–12", rest, cue);
const row = (sets: number, rest: number, cue: string) =>
  lift("seated-row", "تجديف جالس", "seated-row", sets, "8–12", rest, cue);
const biceps = (sets: number, rest: number, cue: string) =>
  lift("biceps", "بايسبس بالجهاز", "biceps", sets, "10–15", rest, cue);
const press = (sets: number, reps: string, rest: number, cue: string) =>
  lift("leg-press", "ضغط الأرجل", "leg-press", sets, reps, rest, cue);
const curl = (sets: number, rest: number, cue: string) =>
  lift("leg-curl", "ثني الأرجل الخلفي", "leg-curl", sets, "10–15", rest, cue);
const ext = (sets: number, reps: string, rest: number, cue: string) =>
  lift("leg-ext", "تمديد الأرجل", "leg-ext", sets, reps, rest, cue);
const calf = (cue: string) => lift("calf", "رفع السمانة", "calf", 3, "12–20", 60, cue);
const hip = (cue: string) => lift("hip-abduction", "فتح الفخذ للخارج", "hip-abduction", 2, "12–15", 60, cue);

export const PLANS: Record<"push" | "pull" | "legs" | "upper" | "lower", ExerciseDef[]> = {
  push: [
    walkIn,
    chest(3, 120, "ادفع للأمام بتحكم، ولا تدفع الكتفين للأمام في نهاية الحركة."),
    fly(2, 75, "قرّب الذراعين للأمام مع ثني خفيف وثابت في المرفقين."),
    shoulder(2, 90, "ادفع نحو الأعلى. توقف إذا شعرت بألم في الكتف."),
    tri(2, 75, "ادفع المقابض للأسفل، ولا ترفع الكتفين نحو الأذنين."),
    walkOut(10),
  ],
  pull: [
    walkIn,
    latBar(3, 120, "اسحب البار نحو أعلى الصدر. لا تسحب خلف الرقبة."),
    row(3, 90, "اسحب باتجاه البطن دون تقويس أسفل الظهر أو التأرجح."),
    biceps(3, 75, "أسند الذراعين على المسند، وتحكم في النزول."),
    walkOut(10),
  ],
  legs: [
    walkIn,
    press(3, "8–12", 120, "أبقِ القدم كاملة على الدواسة، ولا تقفل الركبتين بقوة."),
    curl(3, 90, "اضبط الجهاز على مفصل الركبة، وحرّك الوزن دون اندفاع."),
    ext(2, "10–15", 75, "مدّ الركبتين بسلاسة، وتحكم في النزول."),
    calf("ارفع الكعب بمدى مريح ثم انزل ببطء دون ارتداد."),
    hip("افتح الفخذين بتحكم. هذا جهاز الفتح، لا دوران الجذع."),
    walkOut(5),
  ],
  upper: [
    walkIn,
    row(2, 90, "الحصة الثانية للظهر. حافظ على الثبات."),
    chest(2, 90, "حافظ على المسار، دون استنزاف كامل القوة."),
    latInd(2, 90, "ذراعان منفصلتان، مختلف عن سحب الاثنين. اسحبهما معًا."),
    fly(2, 60, "مجموعتان تكملان ضغط الصدر. لا تزد الحجم."),
    shoulder(2, 90, "الكتف للمرة الثانية بجهد مضبوط."),
    biceps(2, 60, "توقف ومعك تكراران أو ثلاثة قبل العجز."),
    tri(2, 60, "الدفعة الثانية للذراع. تجنب ألم المرفق."),
    walkOut(10),
  ],
  lower: [
    walkIn,
    curl(3, 90, "ابدأ بالخلفية. التوزيع مختلف عن الثلاثاء."),
    press(3, "10–12", 120, "دفع مستقر. لا تحبس النفس طويلًا."),
    ext(2, "12–15", 75, "التحكم أهم من رفع الوزن."),
    calf("قف لحظة في الأعلى ثم انزل ببطء."),
    hip("مجموعتان فقط. إضافة للورك لا حصة مستقلة."),
    walkOut(5),
  ],
};

const LEGACY: Record<string, ExerciseDef> = {
  abs: { id: "abs", name: "جهاز بطن", kind: "strength", image: "abs", sets: 3, reps: "8–12" },
  "rear-delt": { id: "rear-delt", name: "كتف خلفي", kind: "strength", image: "rear-delt", sets: 3, reps: "8–12" },
  "back-ext": { id: "back-ext", name: "أسفل الظهر", kind: "strength", image: "back-ext", sets: 3, reps: "8–12" },
};

export const PLAN_TITLE: Record<PlanId, string> = {
  push: "الأحد · دفع",
  pull: "الاثنين · سحب",
  legs: "الثلاثاء · أرجل",
  upper: "الخميس · علوي",
  lower: "الجمعة · سفلي",
  A: "يوم سابق · دفع",
  B: "يوم سابق · سحب",
  C: "يوم سابق · أرجل",
};

function planKey(plan: PlanId): keyof typeof PLANS {
  if (plan === "A") return "push";
  if (plan === "B") return "pull";
  if (plan === "C") return "legs";
  return plan in PLANS ? plan as keyof typeof PLANS : "push";
}

export function slotsFor(plan: PlanId, kind: SessionKind, state?: JeetState): ExerciseDef[] {
  const full = state?.plans.find((item) => item.id === plan)?.exercises ?? PLANS[planKey(plan)];
  if (kind === "full") return full;
  const first = full.filter((item) => item.kind === "strength").slice(0, 2);
  const warmup = full.find((item) => item.kind === "walk");
  return first.length ? [...(warmup ? [warmup] : []), ...first] : full.slice(0, 2);
}

export function slotFor(plan: PlanId, exerciseId: string, state?: JeetState): ExerciseDef {
  return slotsFor(plan, "full", state).find((item) => item.id === exerciseId) ?? defById(exerciseId, state);
}

export function defById(id: string, state?: JeetState): ExerciseDef {
  const custom = state?.library.find((item) => item.id === id);
  if (custom) return custom;
  for (const list of Object.values(PLANS)) {
    const found = list.find((item) => item.id === id);
    if (found) return found;
  }
  return LEGACY[id] ?? { id, name: "تمرين سابق", kind: "strength", image: "", sets: 3, reps: "8–12", rest: 90 };
}

export function defaultPlans(): WorkoutPlan[] {
  const names = { push: "دفع", pull: "سحب", legs: "أرجل", upper: "علوي", lower: "سفلي" };
  const descriptions = { push: "صدر، كتف وترايسبس", pull: "ظهر وبايسبس", legs: "قوة الجزء السفلي", upper: "توازن الجزء العلوي", lower: "أرجل وورك وسمانة" };
  return Object.entries(PLANS).map(([id, exercises]) => ({
    id, name: names[id as keyof typeof names], description: descriptions[id as keyof typeof descriptions],
    exercises: exercises.map((item) => ({ ...item, walk: item.walk ? { ...item.walk } : undefined })),
  }));
}

export function defaultLibrary(): ExerciseDef[] {
  return [...new Map([...Object.values(PLANS).flat(), ...Object.values(LEGACY)].map((item) => [item.id, { ...item, equipment: item.kind === "walk" ? "كارديو" : "جهاز" }])).values()];
}

export function planTitle(state: JeetState, id: string): string {
  return state.plans.find((plan) => plan.id === id)?.name ?? PLAN_TITLE[id]?.split(" · ").at(-1) ?? "جدول سابق";
}

export function estimatedMinutes(exercises: ExerciseDef[]) {
  return Math.max(1, Math.round(exercises.reduce((n, item) => n + (item.kind === "walk" ? item.walk?.minutes ?? 6 : item.sets * 0.65 + Math.max(0, item.sets - 1) * (item.rest ?? 90) / 60), 0)));
}

export function newId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

