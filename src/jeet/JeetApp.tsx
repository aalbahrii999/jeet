import { useEffect, useState } from "react";
import { BarChart3, Dumbbell, Home, Library, Settings } from "./icons";
import { HomeView, MeasureView, SettingsView, TrainView } from "./views";
import { StatsView } from "./report";
import { PlansView } from "./plans-view";
import { BrandMark } from "./brand";
import { iso, measuredThisWeek, sessionOn, shotThisWeek } from "./logic";
import { androidBridge, jeetWindow } from "./native";
import { refreshWeek, setDraft, useJeet } from "./store";
import { RestTimerDock } from "./rest-timer-ui";
import { useHasRestTimer } from "./rest-timer";
import type { TabId } from "./types";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "اليوم", icon: Home }, { id: "train", label: "التمرين", icon: Dumbbell },
  { id: "plans", label: "خطتي", icon: Library }, { id: "stats", label: "تقدمي", icon: BarChart3 }, { id: "settings", label: "المزيد", icon: Settings },
];
export function JeetApp() {
  const { state, ready, error } = useJeet(), [tab, setTab] = useState<TabId>("home"), [today, setToday] = useState(() => new Date());
  const hasRest = useHasRestTimer();
  const dateKey = iso(today);
  useEffect(() => {
    const refresh = () => { setToday(new Date()); refreshWeek(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, []);
  useEffect(() => {
    const win = jeetWindow();
    win.jeetBack = () => {
      if (!window.dispatchEvent(new Event("jeet:back", { cancelable: true }))) return "stay";
      if (tab === "train" && state.draft && state.draft.step > 0) { setDraft({ ...state.draft, step: state.draft.step - 1 }); return "stay"; }
      if (tab !== "home") { setTab(tab === "measure" ? "stats" : "home"); return "stay"; }
      return "exit";
    };
    return () => { delete win.jeetBack; };
  }, [tab, state.draft]);
  useEffect(() => {
    if (!ready || error) return;
    const sync = () => androidBridge()?.syncReminder?.(JSON.stringify({ enabled: state.reminders, time: state.reminder, days: state.gymDays, skipToday: Boolean(sessionOn(state, new Date())), today: iso(new Date()), measureDay: 5, measureTime: state.measureTime, skipMeasure: measuredThisWeek(state, new Date()) && shotThisWeek(state, new Date()) }));
    jeetWindow().jeetSyncReminders = sync; sync();
    return () => { delete jeetWindow().jeetSyncReminders; };
  }, [ready, error, dateKey, state]);
  if (!ready) return <div className="app-content" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }} role="status"><div><BrandMark /><p className="form-note" style={{ marginTop: 18 }}>نجهّز خطوتك القادمة…</p></div></div>;
  return <div className={`app-shell ${hasRest ? "has-rest" : ""}`}><main className="app-content" id="main-content"><header className="topbar"><BrandMark /><span className="save-status">بياناتك على جهازك</span></header>
    {error ? <div className="notice-banner" role="alert">{error}<button className="text-button" onClick={() => setTab("settings")}>فتح إدارة البيانات</button></div> : null}
    {tab === "home" ? <HomeView state={state} today={today} onTrain={() => setTab("train")} onMeasure={() => setTab("measure")} onPlans={() => setTab("plans")} /> : null}
    {tab === "train" ? <TrainView state={state} today={today} onLeave={() => setTab("home")} /> : null}
    {tab === "plans" ? <PlansView state={state} /> : null}
    {tab === "measure" ? <MeasureView state={state} today={today} /> : null}
    {tab === "stats" ? <StatsView state={state} today={today} onMeasure={() => setTab("measure")} /> : null}
    {tab === "settings" ? <SettingsView state={state} onTab={setTab} /> : null}
  </main><RestTimerDock /><nav className="app-nav" aria-label="التنقل الرئيسي"><div className="nav-inner">{TABS.map((item) => { const active = tab === item.id || (tab === "measure" && item.id === "stats"), Icon = item.icon; return <button className={`nav-item ${active ? "active" : ""}`} key={item.id} aria-current={active ? "page" : undefined} onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: "instant" }); }}><Icon size={22} />{item.label}</button>; })}</div></nav></div>;
}
