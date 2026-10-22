import assert from "node:assert/strict";
import { test } from "node:test";
import { loadJeet } from "./jeet-test-loader.mjs";

const session = (date, plan = "push", kg = 40, extra = {}) => ({ id: `${date}-${plan}`, date, plan, kind: "full", exercises: [{ exerciseId: "chest-press", sets: [{ kg, reps: 12 }, { kg, reps: 12 }] }], ...extra });
test("Jeet program, migration and storage", async (t) => {
  const { schema, logic, program, plan } = await loadJeet();
  await t.test("Saturday makeup and plan continuity across weeks", () => {
    const s = schema.defaultState(); s.sessions = [session("2026-10-18"), session("2026-10-19", "pull"), session("2026-10-20", "legs"), session("2026-10-22", "upper")];
    assert.equal(logic.canTrain(s, new Date(2026, 9, 24)), true);
    assert.equal(logic.weekProgress(s, new Date(2026, 9, 24)), 4);
    assert.equal(logic.planForDate(s, new Date(2026, 9, 25)), "lower");
  });
  await t.test("custom plans create editable sets without fabricated repetitions", () => {
    let s = schema.defaultState(); const ex = { id: "custom", name: "وزن الجسم", kind: "strength", image: "", sets: 4, reps: "6–8", rest: 60, equipment: "وزن الجسم" };
    s = program.saveExercise(s, ex); s = program.savePlan(s, { id: "my-plan", name: "حصتي", description: "", exercises: [ex] });
    const d = logic.createDraft(s, new Date(2026, 9, 22), "full", "my-plan");
    assert.equal(d.logs[0].sets.length, 4); assert.equal(d.logs[0].sets[0].reps, null); assert.equal(d.logs[0].sets[0].done, false);
    const updated = program.saveExercise(s, { ...ex, name: "اسم جديد" });
    assert.equal(updated.plans.at(-1).exercises[0].name, "اسم جديد"); assert.equal(d.logs[0].definition.name, "وزن الجسم");
  });
  await t.test("plan reordering, duplication, validation and last-plan protection", () => {
    let s = schema.defaultState(); const old = s.plans[0]; s = program.copyPlan(s, old);
    assert.notEqual(s.plans.at(-1).id, old.id); assert.equal(s.plans.length, 6);
    const moved = program.reorder(s.plans, 0, 1); assert.equal(moved[1].id, old.id); assert.equal(s.plans[0].id, old.id);
    assert.throws(() => program.savePlan(s, { ...old, exercises: [] }));
    assert.throws(() => program.savePlan(s, { ...old, exercises: [old.exercises[0], old.exercises[0]] }));
    assert.throws(() => program.removePlan({ ...s, plans: [old] }, old.id));
    assert.throws(() => program.archiveExercise(s, old.exercises[0].id));
  });
  await t.test("day changes preserve historical weekly targets", () => {
    const s = schema.defaultState(); s.weekTargets = { "2026-10-11": 5, "2026-10-18": 5 };
    const next = program.changeDays(s, [0, 2, 4], new Date(2026, 9, 22));
    assert.equal(next.weekTargets["2026-10-11"], 5); assert.equal(next.weekTargets["2026-10-18"], 3);
    assert.throws(() => program.changeDays(s, []));
  });
  await t.test("legacy state migrates safely with exercise snapshots", () => {
    const s = schema.defaultState(); s.sessions = [session("2026-10-18")];
    for (const key of ["schemaVersion", "plans", "library", "weekTargets", "autoRest"]) delete s[key]; s.version = "1.3.0";
    const next = schema.validateState(s); assert.equal(next.schemaVersion, 2); assert.equal(next.sessions.length, 1); assert.equal(next.plans.length, 5);
    assert.equal(next.sessions[0].exercises[0].definition.name, "ضغط الصدر");
    assert.equal(next.sessions[0].planName, "دفع");
    const roundtrip = schema.validateState(schema.backupDocument(next)); assert.deepEqual(JSON.parse(JSON.stringify(roundtrip)), JSON.parse(JSON.stringify(next)));
  });
  await t.test("unrelated JSON and malformed nested records are rejected", () => {
    assert.throws(() => schema.validateState({ unrelated: true }));
    const s = schema.defaultState(); assert.throws(() => schema.validateState({ ...s, sessions: [null] }));
    assert.throws(() => schema.validateState({ ...s, measures: [{ date: "2026-02-30", weight: 80, waist: 90 }] }));
    assert.throws(() => schema.validateState({ ...s, schemaVersion: 3 }));
    assert.throws(() => schema.validateState({ ...s, gymDays: [] }));
  });
  await t.test("1.3 update retains photos, measurements, moved days and an unfinished workout after the first save", async () => {
    const { store } = await loadJeet();
    const image = "data:image/png;base64,aGVsbG8=";
    const legacy = {
      version: "1.3.0", gymDays: [0, 1, 2, 4, 5], reminder: "17:30", measureTime: "08:15", reminders: false,
      sessions: [session("2026-10-18")], measures: [{ date: "2026-10-16", weight: 83.5, waist: 91 }],
      bodyShots: [{ date: "2026-10-16", image }], photos: { "chest-press": image },
      moves: { "2026-10-17": { "1": 3 } }, streak: 2, ember: false, lastSettledWeek: "2026-10-17",
      draft: { date: "2026-10-22", plan: "push", kind: "full", step: 0, logs: [{ exerciseId: "chest-press", sets: [{ kg: 42.5, reps: 10 }, { kg: null, reps: null }] }] },
    };
    const original = JSON.stringify(legacy); let saved = original;
    globalThis.localStorage = { getItem: key => key === "jeet.v1" ? saved : null, setItem: (key, value) => { assert.equal(key, "jeet.v1"); saved = value; } };
    store.hydrate(); assert.equal(saved, original, "reading does not rewrite the original");
    assert.equal(store.update(s => ({ ...s, reminder: "19:00" })), true);
    const next = schema.validateState(JSON.parse(saved));
    for (const key of ["measures", "bodyShots", "photos", "moves", "gymDays"]) assert.deepEqual(next[key], legacy[key]);
    assert.deepEqual(next.sessions[0].exercises[0].sets, legacy.sessions[0].exercises[0].sets);
    assert.deepEqual(next.draft.logs[0].sets, legacy.draft.logs[0].sets);
    assert.equal(next.draft.logs[0].definition.name, "ضغط الصدر"); assert.equal(next.draft.planName, "دفع");
    assert.equal(next.measureTime, "08:15"); assert.equal(next.reminders, false);
    const edited = program.saveExercise(next, { ...next.library.find(ex => ex.id === "chest-press"), name: "اسم آخر" });
    assert.equal(edited.draft.logs[0].definition.name, "ضغط الصدر");
    delete globalThis.localStorage;
  });
  await t.test("return weights never increase or compound during a return phase", () => {
    const s = schema.defaultState(); s.ember = true; s.sessions = [session("2026-10-01", "push", 2)];
    assert.equal(logic.suggestKg(s, "chest-press", new Date(2026, 9, 22)), 1.5);
    s.sessions = [session("2026-10-01", "push", 40), session("2026-10-20", "push", 35, { comeback: true })];
    assert.equal(logic.suggestKg(s, "chest-press", new Date(2026, 9, 22)), 32.5);
    s.sessions.push(session("2026-10-22", "upper", 32.5, { comeback: true }));
    assert.equal(logic.suggestKg(s, "chest-press", new Date(2026, 9, 23)), 32.5);
  });
  await t.test("future records do not satisfy this week's measurement", () => {
    const s = schema.defaultState(); s.measures = [{ date: "2026-11-01", waist: 90, weight: 80 }]; assert.equal(logic.measuredThisWeek(s, new Date(2026, 9, 22)), false);
  });
  await t.test("failed persistence leaves memory and saved data unchanged", async () => {
    const { store } = await loadJeet(); const disk = new Map(); let fail = false;
    globalThis.localStorage = { getItem: key => disk.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error("quota"); disk.set(key, value); } };
    store.hydrate(); assert.equal(store.saveSession(session("2026-10-22")), true); const before = store.getState(), saved = disk.get("jeet.v1"); fail = true;
    assert.equal(store.saveSession(session("2026-10-23")), false); assert.equal(store.getState(), before); assert.equal(disk.get("jeet.v1"), saved);
  });
  await t.test("corrupt saved data is retained and can be explicitly recovered", async () => {
    const { store } = await loadJeet(); let raw = '{"sessions":[';
    globalThis.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
    store.hydrate(); assert.equal(raw, '{"sessions":['); assert.equal(store.getRecoveryData(), raw); assert.equal(store.setDraft(null), false);
    assert.equal(store.replaceState(schema.backupDocument(schema.defaultState())), true); assert.equal(store.getRecoveryData(), null);
  });
  await t.test("read failures cannot be followed by an accidental overwrite", async () => {
    const { store } = await loadJeet(); let writes = 0;
    globalThis.localStorage = { getItem: () => { throw new Error("read"); }, setItem: () => { writes++; } };
    store.hydrate(); assert.equal(store.setDraft(null), false); assert.equal(writes, 0);
  });
  await t.test("all starter templates have unique valid plans and exercises", () => {
    for (const kind of ["default", "three"]) { const template = program.templatePlans(kind); const state = schema.defaultState(); const next = schema.validateState({ ...state, plans: template.plans, gymDays: template.days }); assert.equal(next.plans.length, kind === "three" ? 3 : 5); }
    assert.equal(plan.defaultLibrary().length, new Set(plan.defaultLibrary().map(ex => ex.id)).size);
  });
  delete globalThis.localStorage;
});
