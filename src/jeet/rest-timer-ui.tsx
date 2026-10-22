import { Timer, Vibrate, X } from "lucide-react";
import { Btn } from "./ui";
import { allowPocketAlert, cancelRest, extendRest, formatRest, startRest, useRestTimer } from "./rest-timer";

export function RestStart({ exerciseKey, name, seconds }: { exerciseKey: string; name: string; seconds: number }) {
  const { timer, remaining, error } = useRestTimer();
  const active = timer?.exerciseKey === exerciseKey && remaining > 0;
  return (
    <div className="flex flex-col gap-2">
      <Btn variant="ghost" onClick={() => startRest(exerciseKey, name, seconds)}>
        <Timer className="size-5" aria-hidden />
        {active ? "ابدأ الراحة من جديد" : "ابدأ الراحة"}
        <span dir="ltr" className="tabular-nums">{formatRest(seconds * 1000)}</span>
      </Btn>
      {error && !timer ? <p role="alert" className="text-sm text-flame">{error}</p> : null}
    </div>
  );
}

export function RestTimerDock() {
  const { timer, remaining, error } = useRestTimer();
  if (!timer) return null;
  const done = remaining === 0;
  const progress = Math.max(0, Math.min(100, remaining / (timer.duration * 1000) * 100));
  return (
    <aside className="rest-timer-dock" aria-label="عداد الراحة">
      <div className={`rounded-card border bg-surface p-4 shadow-2xl ${done ? "border-flame" : "border-line"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{timer.exerciseName}</p>
            <p role="status" className="font-medium">{done ? "انتهت الراحة · جاهز للجولة التالية" : "خذ راحتك"}</p>
          </div>
          <div role="timer" aria-live="off" dir="ltr" className={`text-4xl font-semibold tabular-nums ${done ? "text-flame" : "text-fg"}`}>
            {formatRest(remaining)}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
          <div className="rest-timer-progress h-full rounded-full bg-flame" style={{ width: `${progress}%` }} />
        </div>
        {timer.native && !timer.exact && !done ? (
          <p className="mt-2 text-xs text-muted">
            لضبط موعد الاهتزاز عند قفل الجوال،{" "}
            <button type="button" onClick={allowPocketAlert} className="min-h-11 underline underline-offset-4 text-fg">اسمح بتنبيه الراحة</button>.
          </p>
        ) : null}
        {!done && timer.native && timer.exact ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted"><Vibrate className="size-3.5" aria-hidden />اهتزاز عند انتهاء الراحة، حتى مع قفل الجوال</p>
        ) : null}
        {!done && !timer.native ? <p className="mt-2 text-xs text-muted">تنبيه الجيب متاح في نسخة أندرويد المحدثة.</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-flame">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          {done ? (
            <Btn className="w-full" onClick={cancelRest}>ابدأ الجولة التالية</Btn>
          ) : (
            <>
              <Btn variant="ghost" className="flex-1" onClick={extendRest}>+٣٠ ثانية</Btn>
              <Btn variant="quiet" onClick={cancelRest}><X className="size-4" aria-hidden />إلغاء</Btn>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
