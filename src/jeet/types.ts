export const APP_VERSION = "1.1.0";
export const APP_VERSION_CODE = 2;

export type PlanId = "A" | "B" | "C";
export type SessionKind = "full" | "min";
export type TabId = "home" | "train" | "measure" | "stats" | "settings";

export type StrengthSet = { kg: number | null; reps: number | null };

export type ExerciseLog = {
  exerciseId: string;
  sets: StrengthSet[];
  walk?: { minutes: number; speed: number; incline: number };
};

export type Session = {
  id: string;
  date: string;
  plan: PlanId;
  kind: SessionKind;
  exercises: ExerciseLog[];
};

export type Measure = { date: string; waist: number; weight: number };

export type Draft = {
  date: string;
  plan: PlanId;
  kind: SessionKind;
  step: number;
  logs: ExerciseLog[];
};

export type ExerciseDef = {
  id: string;
  name: string;
  kind: "strength" | "walk";
  image: string;
  sets: number;
  reps?: string;
  altId?: string;
  cue?: string;
  walk?: { minutes: number; speed: number; incline: number };
};

export type JeetState = {
  version: string;
  gymDays: number[];
  reminder: string;
  reminders: boolean;
  sessions: Session[];
  measures: Measure[];
  moves: Record<string, Record<string, number>>;
  photos: Record<string, string>;
  streak: number;
  ember: boolean;
  lastSettledWeek: string | null;
  draft: Draft | null;
};
