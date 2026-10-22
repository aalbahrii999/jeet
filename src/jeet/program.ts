import { defaultPlans, newId } from "./plan";
import { iso, weekStart } from "./logic";
import { validateExercise } from "./schema";
import type { ExerciseDef, JeetState, WorkoutPlan } from "./types";

export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items], [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
export function savePlan(state: JeetState, plan: WorkoutPlan): JeetState {
  if (!plan.name.trim() || plan.name.trim().length > 70) throw new Error("اكتب اسمًا للجدول لا يتجاوز ٧٠ حرفًا.");
  if (!plan.exercises.length || plan.exercises.length > 25) throw new Error("أضف من تمرين واحد إلى ٢٥ تمرينًا.");
  const exercises = plan.exercises.map(validateExercise);
  if (new Set(exercises.map((exercise) => exercise.id)).size !== exercises.length) throw new Error("التمرين موجود بالفعل. عدّل عدد مجموعاته بدل تكراره.");
  const saved = { ...plan, name: plan.name.trim(), description: plan.description.trim().slice(0, 160), exercises };
  const existing = state.plans.some((item) => item.id === plan.id);
  if (!existing && state.plans.length >= 14) throw new Error("يمكنك الاحتفاظ بـ١٤ جدولًا. احذف جدولًا لا تحتاجه أولًا.");
  return { ...state, plans: existing ? state.plans.map((item) => item.id === plan.id ? saved : item) : [...state.plans, saved] };
}
export function saveExercise(state: JeetState, raw: ExerciseDef): JeetState {
  const exercise = validateExercise(raw);
  return { ...state,
    library: state.library.some((item) => item.id === exercise.id) ? state.library.map((item) => item.id === exercise.id ? exercise : item) : [...state.library, exercise],
    plans: state.plans.map((plan) => ({ ...plan, exercises: plan.exercises.map((item) => item.id !== exercise.id ? item : item.kind === exercise.kind ? { ...exercise, sets: item.sets, reps: item.reps, rest: item.rest } : { ...exercise }) })),
  };
}
export function removePlan(state: JeetState, id: string): JeetState {
  if (state.plans.length <= 1) throw new Error("احتفظ بجدول تدريب واحد على الأقل.");
  return { ...state, plans: state.plans.filter((plan) => plan.id !== id) };
}
export function archiveExercise(state: JeetState, id: string): JeetState {
  if (state.plans.some((plan) => plan.exercises.some((exercise) => exercise.id === id))) throw new Error("أزل التمرين من الجداول التي تستخدمه أولًا. سجلاته السابقة ستبقى محفوظة.");
  return { ...state, library: state.library.map((exercise) => exercise.id === id ? { ...exercise, archived: true } : exercise) };
}
export function changeDays(state: JeetState, days: number[], today = new Date()): JeetState {
  const gymDays = [...new Set(days)].sort((a, b) => a - b);
  if (!gymDays.length || gymDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("اختر يوم تدريب واحدًا على الأقل.");
  return { ...state, gymDays, weekTargets: { ...state.weekTargets, [iso(weekStart(today))]: gymDays.length } };
}
export function copyPlan(state: JeetState, plan: WorkoutPlan) { return savePlan(state, { ...plan, id: newId("plan"), name: `${plan.name.slice(0, 58)} · نسخة`, exercises: plan.exercises.map((exercise) => ({ ...exercise, walk: exercise.walk ? { ...exercise.walk } : undefined })) }); }
export function templatePlans(kind: "default" | "three"): { plans: WorkoutPlan[]; days: number[] } {
  const plans = defaultPlans();
  if (kind === "default") return { plans, days: [0, 1, 2, 4, 5] };
  const all = plans.flatMap((plan) => plan.exercises);
  const get = (id: string) => ({ ...all.find((exercise) => exercise.id === id)! });
  return { days: [0, 2, 4], plans: [
    { id: newId("plan"), name: "شامل أ", description: "صدر، ظهر وأرجل", exercises: [get("walk-in"), get("leg-press"), get("chest-press"), get("seated-row"), get("calf")] },
    { id: newId("plan"), name: "شامل ب", description: "خلفية، كتف وسحب", exercises: [get("walk-in"), get("leg-curl"), get("shoulder-press"), get("lat-pulldown"), get("biceps")] },
    { id: newId("plan"), name: "شامل ج", description: "أرجل، صدر وظهر", exercises: [get("walk-in"), get("leg-ext"), get("chest-press"), get("seated-row"), get("triceps")] },
  ] };
}
