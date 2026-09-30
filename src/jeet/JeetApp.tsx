import { useEffect, useState } from "react";
import { BarChart3, Dumbbell, Flame, Ruler, Settings } from "lucide-react";
import { HomeView, MeasureView, SettingsView, TrainView } from "./views";
import { StatsView } from "./report";
import { effectiveDays, iso, sessionOn } from "./logic";
import { androidBridge, jeetWindow } from "./native";
import { setDraft, useJeet } from "./store";
import type { TabId } from "./types";

const TABS: { id: TabId; label: string; icon: typeof Flame }[] = [
  { id: "home", label: "اليوم", icon: Flame },
  { id: "train", label: "التمرين", icon: Dumbbell },
  { id: "measure", label: "القياس", icon: Ruler },
  { id: "stats", label: "إحصاء", icon: BarChart3 },
  { id: "settings", label: "الإعداد", icon: Settings },
];

export function JeetApp() {
  const { state } = useJeet();
  const [tab, setTab] = useState<TabId>("home");
  const today = new Date();

  useEffect(() => {
    const win = jeetWindow();
    win.jeetBack = () => {
      if (tab === "train" && state.draft && state.draft.step > 0) {
        setDraft({ ...state.draft, step: state.draft.step - 1 });
        return "stay";
      }
      if (tab !== "home") {
        setTab("home");
        return "stay";
      }
      return "exit";
    };
    return () => {
      delete win.jeetBack;
    };
  }, [tab, state.draft]);

  useEffect(() => {
    const sync = () => {
      const bridge = androidBridge();
      if (!bridge?.syncReminder) return;
      const now = new Date();
      bridge.syncReminder(
        JSON.stringify({
          enabled: state.reminders,
          time: state.reminder,
          days: effectiveDays(state, now),
          skipToday: Boolean(sessionOn(state, now)),
          today: iso(now),
        }),
      );
    };
    jeetWindow().jeetSyncReminders = sync;
    sync();
    return () => {
      delete jeetWindow().jeetSyncReminders;
    };
  }, [state.reminders, state.reminder, state.gymDays, state.moves, state.sessions]);

  useEffect(() => {
    androidBridge()?.requestNotify?.();
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 pb-28">
        <>
          {tab === "home" ? <HomeView state={state} today={today} onTrain={() => setTab("train")} /> : null}
          {tab === "train" ? <TrainView state={state} today={today} /> : null}
          {tab === "measure" ? <MeasureView state={state} today={today} /> : null}
          {tab === "stats" ? <StatsView state={state} today={today} /> : null}
          {tab === "settings" ? <SettingsView state={state} onTab={setTab} /> : null}
        </>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-flame" : "text-muted"}`}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}