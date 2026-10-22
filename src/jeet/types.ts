export const APP_VERSION = "2.0.0";
export const APP_VERSION_CODE = 5;

export type PlanId = string;
export type SessionKind = "full" | "min";
export type TabId = "home" | "train" | "plans" | "measure" | "stats" | "settings";

export type StrengthSet = { kg: number | null; reps: number | null; done?: boolean };

export type ExerciseLog = {
  exerciseId: string;
  definition?: ExerciseDef;
  completed?: boolean;
  sets: StrengthSet[];
  walk?: { minutes: number; speed: number; incline: number };
};

export type Session = {
  id: string;
  date: string;
  plan: PlanId;
  planName?: string;
  durationMinutes?: number;
  comeback?: boolean;
  kind: SessionKind;
  exercises: ExerciseLog[];
};

export type Measure = { date: string; waist: number; weight: number };

export type BodyShot = { date: string; image: string };

export type Draft = {
  date: string;
  plan: PlanId;
  planName?: string;
  startedAt?: number;
  comeback?: boolean;
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
  rest?: number;
  altId?: string;
  cue?: string;
  equipment?: string;
  muscle?: string;
  archived?: boolean;
  walk?: { minutes: number; speed: number; incline: number };
};

export type WorkoutPlan = { id: string; name: string; description: string; exercises: ExerciseDef[] };

export type JeetState = {
  schemaVersion: 2;
  version: string;
  plans: WorkoutPlan[];
  library: ExerciseDef[];
  weekTargets: Record<string, number>;
  autoRest: boolean;
  gymDays: number[];
  reminder: string;
  measureTime: string;
  reminders: boolean;
  sessions: Session[];
  measures: Measure[];
  bodyShots: BodyShot[];
  moves: Record<string, Record<string, number>>;
  photos: Record<string, string>;
  streak: number;
  ember: boolean;
  lastSettledWeek: string | null;
  draft: Draft | null;
};

