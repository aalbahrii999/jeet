import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";

const encode = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const source = await readFile(new URL("../src/jeet/rest-timer.ts", import.meta.url), "utf8");
const nativeSource = await readFile(new URL("../src/jeet/native.ts", import.meta.url), "utf8");
const nativeUrl = encode(stripTypeScriptTypes(nativeSource));
const reactUrl = encode("export function useEffect(fn) { fn(); } export function useSyncExternalStore(subscribe, read) { return read(); }");
let instance = 0;

async function scenario(run, bridge, saved) {
  const names = ["window", "document", "navigator", "localStorage", "setInterval", "clearInterval", "Date"];
  const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const realDate = Date;
  let now = 1000000;
  const intervals = new Map();
  const events = new Map();
  const writes = new Map();
  if (saved) writes.set("jeet.rest.v1", JSON.stringify(saved));
  const vibrations = [];
  let next = 0;
  const listen = (event, fn) => events.set(event, fn);
  const values = {
    window: { JeetAndroid: bridge, addEventListener: listen },
    document: { visibilityState: "visible", addEventListener: listen },
    navigator: { vibrate: (pattern) => vibrations.push(pattern) },
    localStorage: { getItem: (key) => writes.get(key) ?? null, setItem: (key, value) => writes.set(key, value), removeItem: (key) => writes.delete(key) },
    setInterval: (fn) => { intervals.set(++next, fn); return next; },
    clearInterval: (id) => intervals.delete(id),
    Date: class extends realDate { static now() { return now; } },
  };
  for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  try {
    const js = stripTypeScriptTypes(source)
      .replace('from "react"', `from "${reactUrl}"`)
      .replace('from "./native"', `from "${nativeUrl}"`);
    const timer = await import(encode(`${js}\n// scenario ${++instance}`));
    const read = () => timer.useRestTimer();
    read();
    await run({ timer, read, writes, vibrations, intervals, values,
      advance(ms, deliver = true) { now += ms; if (deliver) for (const fn of [...intervals.values()]) fn(); },
      event(name) { events.get(name)?.(); },
    });
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("rest timer behavior", async (t) => {
  await t.test("a suspended page catches up to elapsed time and vibrates once", () => scenario(({ timer, read, advance, vibrations, event }) => {
    timer.startRest("today:chest", "ضغط الصدر", 90);
    advance(89000, false);
    assert.equal(read().remaining, 90000); // No tick while the page is suspended.
    event("visibilitychange");
    assert.equal(read().remaining, 1000);
    advance(2000);
    assert.equal(read().remaining, 0);
    event("focus");
    event("visibilitychange");
    assert.deepEqual(vibrations.filter(Array.isArray), [[300, 180, 300, 180, 500]]);
  }));
  await t.test("adding 30 seconds replaces the old deadline and cancellation stops it", () => scenario(({ timer, read, advance, intervals, vibrations }) => {
    timer.startRest("today:chest", "ضغط الصدر", 90);
    advance(60000);
    const oldId = read().timer.id;
    timer.extendRest();
    assert.equal(read().remaining, 60000);
    assert.notEqual(read().timer.id, oldId);
    advance(31000);
    assert.equal(read().remaining, 29000);
    timer.cancelRest();
    assert.equal(read().timer, null);
    assert.equal(intervals.size, 0);
    advance(60000);
    assert.equal(vibrations.filter(Array.isArray).length, 0);
  }));
  await t.test("restarting never leaves two timers running", () => scenario(({ timer, read, advance, intervals, vibrations }) => {
    timer.startRest("today:chest", "ضغط الصدر", 30);
    advance(20000);
    timer.startRest("today:row", "تجديف", 90);
    assert.equal(intervals.size, 1);
    advance(15000);
    assert.equal(read().timer.exerciseKey, "today:row");
    assert.equal(read().remaining, 75000);
    assert.equal(vibrations.filter(Array.isArray).length, 0);
  }));
  let nativeTimer = null;
  const nativeCalls = [];
  const bridge = {
    startRestTimer(payload) {
      nativeCalls.push("start");
      nativeTimer = { ...JSON.parse(payload), native: true, exact: true };
      return JSON.stringify(nativeTimer);
    },
    restTimerStatus: () => JSON.stringify(nativeTimer),
    cancelRestTimer() { nativeCalls.push("cancel"); nativeTimer = null; },
    openRestAlarmSettings() { nativeCalls.push("settings"); },
  };
  await t.test("Android owns completion; resuming never duplicates its vibration", () => scenario(({ timer, read, advance, event, vibrations }) => {
    timer.startRest("today:chest", "ضغط الصدر", 90);
    assert.equal(read().timer.native, true);
    advance(95000, false);
    nativeTimer.endAt = Date.now();
    event("focus");
    assert.equal(read().remaining, 0);
    event("visibilitychange");
    assert.equal(vibrations.filter(Array.isArray).length, 0);
    timer.cancelRest();
    assert.equal(read().timer, null);
    assert.deepEqual(nativeCalls, ["start", "cancel"]);
  }, bridge));
  await t.test("bridge failure reports an error instead of pretending pocket alerts work", () => scenario(({ timer, read }) => {
    timer.startRest("key", "صدر", 90);
    assert.equal(read().timer, null);
    assert.match(read().error, /تعذّر/);
  }, { startRestTimer: () => "null" }));
  await t.test("full browser storage cannot break an active countdown", () => scenario(({ timer, read, values }) => {
    values.localStorage.setItem = () => { throw new Error("quota"); };
    timer.startRest("key", "صدر", 90);
    assert.equal(read().remaining, 90000);
  }));
  await t.test("invalid storage cannot trigger an old alert", () => scenario(({ read, event, vibrations }) => {
    event("focus");
    assert.equal(read().timer, null);
    assert.equal(vibrations.filter(Array.isArray).length, 0);
  }, undefined, { endAt: "bad" }));
  await t.test("an expired browser rest is not replayed after reload", () => scenario(({ read, event, vibrations }) => {
    event("focus");
    assert.equal(read().timer, null);
    assert.equal(vibrations.filter(Array.isArray).length, 0);
  }, undefined, { id: "old", exerciseKey: "key", exerciseName: "صدر", endAt: 999000, duration: 90, native: false, exact: false }));
  await t.test("an active browser rest is restored after reload", () => scenario(({ read, advance }) => {
    assert.equal(read().remaining, 30000);
    advance(5000);
    assert.equal(read().remaining, 25000);
  }, undefined, { id: "old", exerciseKey: "key", exerciseName: "صدر", endAt: 1030000, duration: 90, native: false, exact: false }));
  await t.test("a rejected restart keeps the previous native timer visible", () => scenario(({ timer, read, values }) => {
    timer.startRest("key", "صدر", 90);
    const previousId = read().timer.id;
    values.window.JeetAndroid.startRestTimer = () => "null";
    timer.startRest("key", "صدر", 120);
    assert.equal(read().timer.id, previousId);
    assert.match(read().error, /تعذّر/);
  }, { startRestTimer: (payload) => JSON.stringify({ ...JSON.parse(payload), native: true, exact: true }) }));
  await t.test("returning from alarm settings upgrades the existing native countdown", () => scenario(({ timer, read, values, event }) => {
    timer.startRest("key", "صدر", 90);
    const active = read().timer;
    assert.equal(active.exact, false);
    values.window.JeetAndroid.restTimerStatus = () => JSON.stringify({ ...active, exact: true, endAt: Date.now() + 60000 });
    event("focus");
    assert.equal(read().timer.id, active.id);
    assert.equal(read().timer.exact, true);
    assert.equal(read().remaining, 60000);
  }, { startRestTimer: (payload) => JSON.stringify({ ...JSON.parse(payload), native: true, exact: false }) }));
  await t.test("display rounds up and never shows negative seconds", () => scenario(({ timer }) => {
    assert.equal(timer.formatRest(90000), "1:30");
    assert.equal(timer.formatRest(1), "0:01");
    assert.equal(timer.formatRest(-100), "0:00");
  }));
});
