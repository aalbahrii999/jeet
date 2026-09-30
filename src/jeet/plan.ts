import type { ExerciseDef, PlanId, SessionKind } from "./types";

const walkIn: ExerciseDef = {
  id: "walk-in",
  name: "مشي إحماء",
  kind: "walk",
  image: "treadmill",
  sets: 1,
  walk: { minutes: 10, speed: 5, incline: 1 },
};

function walkOut(id: string, minutes: number, incline: number): ExerciseDef {
  return {
    id,
    name: "مشي ختام",
    kind: "walk",
    image: "treadmill",
    sets: 1,
    walk: { minutes, speed: 5.5, incline },
  };
}

function strength(
  id: string,
  name: string,
  image: string,
  altId?: string,
): ExerciseDef {
  return { id, name, kind: "strength", image, sets: 3, reps: "8–12", altId };
}

export const EXERCISES: Record<string, ExerciseDef> = {
  "walk-in": walkIn,
  "walk-out-a": walkOut("walk-out-a", 12, 2),
  "walk-out-b": walkOut("walk-out-b", 12, 2),
  "walk-out-c": walkOut("walk-out-c", 15, 3),
  "chest-press": strength("chest-press", "جهاز ضغط صدر", "chest-press", "pec-deck"),
  "shoulder-press": strength("shoulder-press", "جهاز ضغط كتف", "shoulder-press", "rear-delt"),
  "pec-deck": strength("pec-deck", "جهاز فراشة", "pec-deck", "chest-press"),
  triceps: strength("triceps", "جهاز ترايسِبس", "triceps"),
  abs: strength("abs", "جهاز بطن", "abs", "back-ext"),
  "lat-pulldown": strength("lat-pulldown", "سحب عالي", "lat-pulldown", "seated-row"),
  "seated-row": strength("seated-row", "تجديف جالس", "seated-row", "lat-pulldown"),
  "rear-delt": strength("rear-delt", "جهاز كتف خلفي", "rear-delt", "shoulder-press"),
  biceps: strength("biceps", "جهاز بايسِبس", "biceps"),
  "back-ext": strength("back-ext", "جهاز أسفل الظهر", "back-ext", "abs"),
  "leg-press": strength("leg-press", "جهاز ضغط رجل", "leg-press", "leg-ext"),
  "leg-ext": strength("leg-ext", "جهاز مد الرجل", "leg-ext", "leg-press"),
  "leg-curl": strength("leg-curl", "جهاز ثني الرجل", "leg-curl", "leg-ext"),
  calf: strength("calf", "جهاز سمانة", "calf", "leg-press"),
};

export const PLAN_ORDER: Record<PlanId, string[]> = {
  A: ["walk-in", "chest-press", "shoulder-press", "pec-deck", "triceps", "abs", "walk-out-a"],
  B: ["walk-in", "lat-pulldown", "seated-row", "rear-delt", "biceps", "back-ext", "walk-out-b"],
  C: ["walk-in", "leg-press", "leg-ext", "leg-curl", "calf", "abs", "walk-out-c"],
};

export const PLAN_TITLE: Record<PlanId, string> = {
  A: "يوم A · دفع",
  B: "يوم B · سحب",
  C: "يوم C · أرجل",
};

export function exerciseIds(plan: PlanId, kind: SessionKind): string[] {
  const ids = PLAN_ORDER[plan];
  if (kind === "full") return ids;
  const strengthIds = ids.filter((id) => EXERCISES[id].kind === "strength").slice(0, 2);
  const walkOutId = ids.find((id) => id.startsWith("walk-out")) ?? "walk-out-a";
  return ["walk-in", ...strengthIds, walkOutId];
}

export function defById(id: string): ExerciseDef {
  return EXERCISES[id] ?? EXERCISES["chest-press"];
}
