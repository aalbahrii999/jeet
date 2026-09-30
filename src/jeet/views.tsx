import { useEffect, useState } from "react";
import { Camera, Copy, Download, Flame } from "lucide-react";
import { defById, PLAN_TITLE } from "./plan";
import {
  DAY_NAMES,
  buildReport,
  createDraft,
  daysSinceLast,
  draftFromSession,
  effectiveDays,
  inComeback,
  isGymDay,
  iso,
  moveGymDay,
  sessionOn,
  weekdayChips,
  weekProgress,
} from "./logic";
import { saveMeasure, saveSession, setDraft, update, replaceState, defaultState } from "./store";
import type { Draft, ExerciseLog, JeetState, TabId } from "./types";
import { APP_VERSION } from "./types";
import { Btn, Card, Field, MachinePhoto } from "./ui";

async function fileToJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 960 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function patchLog(draft: Draft, index: number, log: ExerciseLog) {
  const logs = draft.logs.map((item, i) => (i === index ? log : item));
  setDraft({ ...draft, logs });
}

export function HomeView({
  state,
  today,
  onTrain,
}: {
  state: JeetState;
  today: Date;
  onTrain: () => void;
}) {
  const done = Math.min(weekProgress(state, today), 3);
  const gym = isGymDay(state, today);
  const attended = Boolean(sessionOn(state, today));
  const comeback = inComeback(state, today);
  const gap = daysSinceLast(state, today);
  const hour = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
  const remind = gym && !attended && hour >= state.reminder;
  const last = [...state.measures].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const days = effectiveDays(state, today);
  const freeDays = weekdayChips(today).filter((d) => !days.includes(d.getDay()));

  let action = "اليوم راحة. الستريك محمي";
  if (state.draft?.date === iso(today)) action = "كمّل تمرين اليوم";
  else if (attended) action = "تم الحضور اليوم";
  else if (gym) action = "جيت";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">جيت</p>
          <h1 className="text-2xl font-semibold">حضورك هذا الأسبوع</h1>
        </div>
        <p className="text-sm tabular-nums text-muted">{APP_VERSION}</p>
      </header>

      <div className="flex flex-col items-center py-2">
        <Flame
          className={`size-16 ${state.ember ? "text-flame/45" : "text-flame flame-live"}`}
          strokeWidth={1.6}
          aria-hidden
        />
        <p className="mt-2 text-6xl font-semibold tabular-nums leading-none">{state.streak}</p>
        <p className="mt-2 text-sm text-muted">
          {state.ember ? "اللهب خافت حتى تكمل أسبوع رجوع" : "أسابيع متتالية بثلاثة أيام"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3" aria-label="تقدم الأسبوع">
        {[0, 1, 2].map((slot) => (
          <span
            key={slot}
            className={`size-4 rounded-full ${slot < done ? "bg-teal" : "bg-raised"}`}
          />
        ))}
      </div>
      <p className="-mt-2 text-center text-sm text-muted">هذا الأسبوع {done}/3</p>
      {done < 3 ? (
        <p className="text-center text-sm text-flame">باقي {3 - done} {3 - done === 1 ? "يوم" : "أيام"} قبل ما يبرد اللهب</p>
      ) : (
        <p className="text-center text-sm text-teal">هذا الأسبوع مكتمل</p>
      )}

      <Card className="p-4">
        <p className="text-sm text-muted">{DAY_NAMES[today.getDay()]}</p>
        <p className="mt-1 text-xl font-semibold">
          {gym ? "يوم نادي" : "يوم راحة"}
          {attended ? " · سجّلت حضورك" : ""}
        </p>
        <p className="mt-1 text-sm text-muted">
          أيامك: {days.map((d) => DAY_NAMES[d]).join(" · ")}
        </p>
        {comeback ? (
          <p className="mt-3 text-sm text-flame">
            وضع الرجوع: أوزان أخف، أو ابدأ بجلسة 20 دقيقة.
            {gap !== null && gap >= 7 ? ` آخر حضور قبل ${gap} يوم.` : ""}
          </p>
        ) : null}
        {remind ? <p className="mt-3 text-sm">حان وقت النادي. حتى جلسة قصيرة تحمي الأسبوع.</p> : null}
        <Btn className="mt-4 w-full" onClick={onTrain}>
          {action}
        </Btn>
        {gym && !attended && freeDays.length ? (
          <div className="mt-3">
            <p className="mb-2 text-sm text-muted">انقل اليوم داخل هذا الأسبوع</p>
            <div className="flex flex-wrap gap-2">
              {freeDays.map((d) => (
                <Btn
                  key={iso(d)}
                  variant="ghost"
                  className="min-h-11 px-3 text-sm"
                  onClick={() => update((current) => moveGymDay(current, today, d.getDay()))}
                >
                  {DAY_NAMES[d.getDay()]}
                </Btn>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted">آخر خصر</p>
          <p className="text-2xl font-semibold tabular-nums">{last ? `${last.waist} سم` : "—"}</p>
        </div>
        <p className="text-sm text-muted">{last ? last.date : "القياس كل أحد"}</p>
      </Card>
    </div>
  );
}

export function TrainView({ state, today }: { state: JeetState; today: Date }) {
  const todayKey = iso(today);
  const existing = sessionOn(state, today);
  const draft = state.draft?.date === todayKey ? state.draft : null;
  const comeback = inComeback(state, today);

  if (!draft) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">التمرين</h1>
        <p className="text-sm text-muted">
          خطة أجهزة ثابتة مع مشي في البداية والنهاية. لا أوزان حرة.
        </p>
        {comeback ? (
          <Card className="p-4 text-sm text-flame">الأوزان المقترحة أقل بحوالي 15 بالمئة لأنك في وضع الرجوع.</Card>
        ) : null}
        {existing ? (
          <Card className="p-4">
            <p className="font-medium">سجّلت {PLAN_TITLE[existing.plan]} اليوم</p>
            <p className="mt-1 text-sm text-muted">{existing.kind === "min" ? "جلسة قصيرة" : "جلسة كاملة"}</p>
            <Btn className="mt-4 w-full" variant="ghost" onClick={() => setDraft(draftFromSession(existing))}>
              تعديل تسجيل اليوم
            </Btn>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <Btn className="w-full" onClick={() => setDraft(createDraft(state, today, "full"))}>
              ابدأ الجلسة الكاملة
            </Btn>
            <Btn className="w-full" variant="ghost" onClick={() => setDraft(createDraft(state, today, "min"))}>
              جلسة 20 دقيقة
            </Btn>
            <p className="text-sm text-muted">الجلسة القصيرة تحسب حضوراً وتحمي الستريك.</p>
          </div>
        )}
      </div>
    );
  }

  const log = draft.logs[draft.step];
  if (!log) return null;
  const def = defById(log.exerciseId);
  const alt = def.altId ? defById(def.altId) : null;
  const lastStep = draft.step === draft.logs.length - 1;

  function swap() {
    if (!alt || !draft) return;
    const kg = log.sets[0]?.kg ?? null;
    const replacement: ExerciseLog =
      alt.kind === "walk"
        ? log
        : {
            exerciseId: alt.id,
            sets: Array.from({ length: alt.sets }, () => ({ kg, reps: kg ? 10 : null })),
          };
    patchLog(draft, draft.step, replacement);
  }

  function finish() {
    if (!draft) return;
    saveSession({
      id: `${draft.date}-${draft.plan}`,
      date: draft.date,
      plan: draft.plan,
      kind: draft.kind,
      exercises: draft.logs,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">
            {PLAN_TITLE[draft.plan]} · {draft.kind === "min" ? "قصيرة" : "كاملة"}
          </p>
          <h1 className="text-xl font-semibold">
            {draft.step + 1} / {draft.logs.length}
          </h1>
        </div>
        <p className="text-sm text-muted">{def.kind === "walk" ? "كارديو" : def.reps}</p>
      </div>
      <Card className="overflow-hidden">
        <MachinePhoto image={def.image} photos={state.photos} alt={def.name} />
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-semibold">{def.name}</h2>
            <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm text-muted">
              <Camera className="size-4" aria-hidden />
              صورة جهازي
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="file-clip"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const url = await fileToJpeg(file);
                  if (!url) return;
                  update((current) => ({
                    ...current,
                    photos: { ...current.photos, [def.image]: url },
                  }));
                }}
              />
            </label>
          </div>
          {def.kind === "walk" && log.walk ? (
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="دقائق"
                value={log.walk.minutes}
                onChange={(minutes) =>
                  patchLog(draft, draft.step, { ...log, walk: { ...log.walk!, minutes: minutes ?? 0 } })
                }
              />
              <Field
                label="السرعة"
                step="0.1"
                value={log.walk.speed}
                onChange={(speed) =>
                  patchLog(draft, draft.step, { ...log, walk: { ...log.walk!, speed: speed ?? 0 } })
                }
              />
              <Field
                label="الميل"
                step="0.5"
                value={log.walk.incline}
                onChange={(incline) =>
                  patchLog(draft, draft.step, { ...log, walk: { ...log.walk!, incline: incline ?? 0 } })
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {log.sets.map((set, index) => (
                <div key={index} className="grid grid-cols-[auto_1fr_1fr] items-end gap-2">
                  <span className="pb-3 text-sm tabular-nums text-muted">{index + 1}</span>
                  <Field
                    label="كغ"
                    step="1"
                    value={set.kg}
                    onChange={(kg) => {
                      const sets = log.sets.map((item, i) => (i === index ? { ...item, kg } : item));
                      patchLog(draft, draft.step, { ...log, sets });
                    }}
                  />
                  <Field
                    label="تكرار"
                    value={set.reps}
                    onChange={(reps) => {
                      const sets = log.sets.map((item, i) => (i === index ? { ...item, reps } : item));
                      patchLog(draft, draft.step, { ...log, sets });
                    }}
                  />
                </div>
              ))}
              <Btn
                variant="quiet"
                className="self-start px-0"
                onClick={() => {
                  const first = log.sets[0];
                  if (!first) return;
                  patchLog(draft, draft.step, {
                    ...log,
                    sets: log.sets.map(() => ({ ...first })),
                  });
                }}
              >
                كرّر المجموعة الأولى
              </Btn>
            </div>
          )}
          {alt ? (
            <Btn variant="ghost" onClick={swap}>
              الجهاز مأخوذ · بدّل إلى {alt.name}
            </Btn>
          ) : null}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Btn
          variant="ghost"
          disabled={draft.step === 0}
          onClick={() => setDraft({ ...draft, step: Math.max(0, draft.step - 1) })}
        >
          السابق
        </Btn>
        {lastStep ? (
          <Btn variant="flame" onClick={finish}>
            إنهاء وحفظ الحضور
          </Btn>
        ) : (
          <Btn onClick={() => setDraft({ ...draft, step: draft.step + 1 })}>التالي</Btn>
        )}
      </div>
    </div>
  );
}

export function MeasureView({ state, today }: { state: JeetState; today: Date }) {
  const key = iso(today);
  const current = state.measures.find((item) => item.date === key);
  const [waist, setWaist] = useState<number | null>(current?.waist ?? null);
  const [weight, setWeight] = useState<number | null>(current?.weight ?? null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!current) return;
    setWaist(current.waist);
    setWeight(current.weight);
  }, [current]);
  const rows = [...state.measures].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-12);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">القياس</h1>
      <p className="text-sm text-muted">
        قف، أخرج الهواء بشكل طبيعي، وثبت الشريط عند السرّة. نفس المكان كل مرة. الخصر أهم من الميزان.
      </p>
      <Card className="grid grid-cols-2 gap-3 p-4">
        <Field label="الخصر سم" step="0.5" value={waist} onChange={setWaist} />
        <Field label="الوزن كغ" step="0.1" value={weight} onChange={setWeight} />
        <Btn
          className="col-span-2"
          disabled={!waist || !weight}
          onClick={() => {
            if (!waist || !weight) return;
            saveMeasure({ date: key, waist, weight });
            setSaved(true);
          }}
        >
          حفظ قياس اليوم
        </Btn>
        {saved ? <p className="col-span-2 text-sm text-teal">تم الحفظ</p> : null}
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">خط الخصر</h2>
        {rows.length < 2 ? (
          <p className="text-sm text-muted">بعد قياسين يظهر الخط.</p>
        ) : (
          <WaistChart rows={rows.map((row) => ({ name: row.date.slice(5), waist: row.waist }))} />
        )}
      </Card>
    </div>
  );
}

function WaistChart({ rows }: { rows: { name: string; waist: number }[] }) {
  const width = 320;
  const height = 140;
  const pad = 16;
  const values = rows.map((row) => row.waist);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const points = rows
    .map((row, index) => {
      const x = pad + (index * (width - pad * 2)) / Math.max(1, rows.length - 1);
      const y = pad + ((max - row.waist) * (height - pad * 2)) / (max - min || 1);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="منحنى الخصر">
      <polyline fill="none" stroke="var(--color-teal)" strokeWidth="3" points={points} />
    </svg>
  );
}

export function ReportView({ state, today }: { state: JeetState; today: Date }) {
  const report = buildReport(state, today);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">التقرير</h1>
      <p className="text-sm text-muted">
        انسخه وأرسله لنموذج ذكاء. التقرير يطلب تعديلاً واحداً ويمنع تغيير الخطة أو الحديث عن الهرمونات.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Btn
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(report.text);
            setCopied(true);
          }}
        >
          <Copy className="size-4" aria-hidden />
          {copied ? "تم النسخ" : "نسخ"}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            const blob = new Blob([report.text], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `jeet-report-${iso(today)}.txt`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" aria-hidden />
          تنزيل
        </Btn>
      </div>
      <Card className="p-4">
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-fg">{report.text}</pre>
      </Card>
    </div>
  );
}

export function SettingsView({ state, onTab }: { state: JeetState; onTab: (tab: TabId) => void }) {
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function chooseDay(dow: number) {
    if (state.gymDays.includes(dow)) {
      setSwapFrom(dow);
      return;
    }
    if (swapFrom === null) return;
    update((current) => {
      const gymDays = current.gymDays.map((day) => (day === swapFrom ? dow : day));
      return { ...current, gymDays };
    });
    setSwapFrom(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">الإعدادات</h1>
      <Card className="p-4">
        <p className="font-medium">أيام النادي</p>
        <p className="mt-1 text-sm text-muted">
          ثلاثة أيام فقط. اضغط يوماً محدداً ثم يوماً آخر لاستبداله.
          {swapFrom !== null ? ` الاستبدال من ${DAY_NAMES[swapFrom]}.` : ""}
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {DAY_NAMES.map((name, dow) => {
            const on = state.gymDays.includes(dow);
            return (
              <button
                key={name}
                type="button"
                onClick={() => chooseDay(dow)}
                className={`min-h-12 rounded-xl text-sm ${on ? "bg-teal text-fg" : "bg-raised text-muted"} ${swapFrom === dow ? "outline outline-2 outline-flame" : ""}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </Card>
      <Card className="p-4">
        <label className="flex flex-col gap-2 text-sm text-muted">
          وقت التذكير في أيامك فقط
          <input
            type="time"
            value={state.reminder}
            onChange={(event) => update((current) => ({ ...current, reminder: event.target.value }))}
            className="h-12 rounded-xl border border-line bg-raised px-3 text-base text-fg"
          />
        </label>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <p className="font-medium">نسخة البيانات</p>
        <Btn
          variant="ghost"
          onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "jeet-backup.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          تصدير النسخة الاحتياطية
        </Btn>
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-raised px-4">
          استيراد نسخة
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              replaceState(JSON.parse(text) as JeetState);
            }}
          />
        </label>
      </Card>
      <Card className="p-4">
        {confirmReset ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">يمسح الحضور والأوزان والقياسات من هذا الجهاز.</p>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={() => setConfirmReset(false)}>
                إلغاء
              </Btn>
              <Btn
                variant="flame"
                onClick={() => {
                  replaceState(defaultState());
                  setConfirmReset(false);
                  onTab("home");
                }}
              >
                مسح
              </Btn>
            </div>
          </div>
        ) : (
          <Btn variant="quiet" className="px-0 text-flame" onClick={() => setConfirmReset(true)}>
            مسح كل البيانات
          </Btn>
        )}
      </Card>
      <p className="text-center text-sm text-muted">جيت {APP_VERSION} · بياناتك تبقى على جهازك</p>
    </div>
  );
}
