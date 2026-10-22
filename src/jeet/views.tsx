import { useEffect, useState } from "react";
import { Camera, Flame } from "lucide-react";
import { DAY_PLAN, PLAN_TITLE, slotFor } from "./plan";
import {
  DAY_NAMES,
  canTrain,
  createDraft,
  daysSinceLast,
  draftFromSession,
  inComeback,
  isGymDay,
  iso,
  measuredThisWeek,
  motivation,
  planForDate,
  readyToBump,
  repCeiling,
  sessionOn,
  shotThisWeek,
  weekProgress,
} from "./logic";
import { defaultState, deleteToday, replaceState, saveBodyShot, saveMeasure, saveSession, setDraft, update } from "./store";
import { Btn, Card, Field, MachinePhoto } from "./ui";
import type { BodyShot, Draft, ExerciseLog, JeetState, TabId } from "./types";
import { APP_VERSION } from "./types";
import { androidBridge, pickDevicePhoto, takeDevicePhoto } from "./native";
import { RestStart } from "./rest-timer-ui";
import { cancelRest } from "./rest-timer";

async function fileToJpeg(file: File, max = 960, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function patchLog(draft: Draft, index: number, log: ExerciseLog) {
  const logs = draft.logs.map((item, i) => (i === index ? log : item));
  setDraft({ ...draft, logs });
}

function PhotoPick({
  facing,
  label,
  className,
  max,
  quality,
  onImage,
  onFail,
}: {
  facing: "user" | "environment";
  label: string;
  className: string;
  max: number;
  quality: number;
  onImage: (url: string) => void;
  onFail: (message: string) => void;
}) {
  const native = Boolean(androidBridge()?.takePhoto);
  if (!native) {
    return (
      <label className={className}>
        <Camera className="size-4" aria-hidden />
        {label}
        <input
          type="file"
          accept="image/*"
          capture={facing}
          className="file-clip"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const url = await fileToJpeg(file, max, quality);
            if (!url) onFail("تعذّر حفظ الصورة.");
            else onImage(url);
          }}
        />
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={className}
        onClick={async () => {
          const result = await takeDevicePhoto(facing);
          if (result === "file" || result === "cancel") return;
          if (result === "denied") onFail("اسمح بالكاميرا لجيت من إعدادات الجوال، ثم حاول مرة أخرى.");
          else onImage(result);
        }}
      >
        <Camera className="size-4" aria-hidden />
        {label}
      </button>
      <button
        type="button"
        className="min-h-11 text-sm text-muted"
        onClick={async () => {
          const result = await pickDevicePhoto();
          if (result === "file" || result === "cancel") return;
          onImage(result);
        }}
      >
        من المعرض
      </button>
    </div>
  );
}

export function HomeView({
  state,
  today,
  onTrain,
  onMeasure,
}: {
  state: JeetState;
  today: Date;
  onTrain: () => void;
  onMeasure: () => void;
}) {
  const target = state.gymDays.length || 5;
  const done = Math.min(weekProgress(state, today), target);
  const gym = isGymDay(state, today);
  const attended = Boolean(sessionOn(state, today));
  const trainable = canTrain(state, today);
  const coming = planForDate(state, today);
  const shifted = trainable && DAY_PLAN[today.getDay()] !== coming;
  const comeback = inComeback(state, today);
  const gap = daysSinceLast(state, today);
  const hour = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
  const remind = gym && !attended && hour >= state.reminder && state.reminders;
  const needMeasure = !measuredThisWeek(state, today);
  const needShot = !shotThisWeek(state, today);
  const [confirmDelete, setConfirmDelete] = useState(false);

  let action = "اليوم راحة. الستريك محمي";
  if (state.draft?.date === iso(today)) action = "كمّل تمرين اليوم";
  else if (attended) action = "تم الحضور اليوم";
  else if (trainable) action = "جيت";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">جيت</p>
          <h1 className="text-2xl font-semibold">حضورك هذا الأسبوع</h1>
        </div>
      </header>

      <div className="flex flex-col items-center py-2">
        <Flame
          className={`size-16 ${state.ember ? "text-flame/45" : "text-flame flame-live"}`}
          strokeWidth={1.6}
          aria-hidden
        />
        <p className="mt-2 text-6xl font-semibold tabular-nums leading-none">{state.streak}</p>
        <p className="mt-2 text-sm text-muted">
          {state.ember ? "اللهب خافت حتى تكمل أسبوع رجوع" : "أسابيع متتالية بخمس حصص"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3" aria-label="تقدم الأسبوع">
        {Array.from({ length: target }, (_, slot) => (
          <span
            key={slot}
            className={`size-4 rounded-full ${slot < done ? "bg-teal" : "bg-raised"}`}
          />
        ))}
      </div>
      <p className="-mt-2 text-center text-sm text-muted">
        هذا الأسبوع <span dir="ltr">{done}/{target}</span>
      </p>
      {done < target ? (
        <p className="text-center text-sm text-flame">
          باقي {target - done} {target - done === 1 ? "حصة" : "حصص"} قبل ما يبرد اللهب
        </p>
      ) : (
        <p className="text-center text-sm text-teal">هذا الأسبوع مكتمل</p>
      )}

      <Card className="p-4">
        <p className="text-sm text-muted">{DAY_NAMES[today.getDay()]}</p>
        <p className="mt-1 text-xl font-semibold">
          {attended ? "سجّلت حضورك" : trainable && !gym ? "تعويض حصة فائتة" : gym ? "يوم نادي" : "يوم راحة"}
        </p>
        <p className="mt-1 text-sm text-muted">
          أيامك: {state.gymDays.map((d) => DAY_NAMES[d]).join(" · ")}
        </p>
        {comeback ? (
          <p className="mt-3 text-sm text-flame">
            وضع الرجوع: مجموعتان فقط، والوزن أخف بحوالي 15 بالمئة.
            {gap !== null && gap >= 7 ? ` آخر حضور قبل ${gap} يوم.` : ""}
          </p>
        ) : null}
        {remind ? <p className="mt-3 text-sm">حان وقت النادي. حتى جلسة قصيرة تحمي الأسبوع.</p> : null}
        <Btn className="mt-4 w-full" onClick={onTrain}>
          {action}
        </Btn>
        {shifted ? (
          <p className="mt-3 text-sm text-teal">معك {PLAN_TITLE[coming]}. الترتيب يتبع حضورك ولا يتخطى حصة.</p>
        ) : null}
        {attended ? (
          confirmDelete ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm">يمسح حضور اليوم فقط، ويرجع ترتيب الحصص خطوة.</p>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>
                  إلغاء
                </Btn>
                <Btn
                  variant="flame"
                  onClick={() => {
                    cancelRest();
                    deleteToday(iso(today));
                    setConfirmDelete(false);
                  }}
                >
                  احذف الحضور
                </Btn>
              </div>
            </div>
          ) : (
            <Btn variant="quiet" className="mt-2 px-0 text-flame" onClick={() => setConfirmDelete(true)}>
              احذف حضور اليوم
            </Btn>
          )
        ) : null}
      </Card>

      <Card className="p-4">
        <p className="text-lg font-medium leading-relaxed">{motivation(state, today)}</p>
      </Card>
      {needMeasure || needShot ? (
        <Card className="p-4">
          <p className="font-medium">{today.getDay() === 5 ? "يوم القياس" : "قياس هذا الأسبوع"}</p>
          <p className="mt-1 text-sm text-muted">
            {needMeasure ? "الوزن والخصر عند السرّة. " : ""}
            {needShot ? "وصورة للجسم بنفس الوقفة والإضاءة." : ""}
          </p>
          <Btn className="mt-4 w-full" onClick={onMeasure}>
            افتح القياس
          </Btn>
        </Card>
      ) : null}
    </div>
  );
}

export function TrainView({ state, today }: { state: JeetState; today: Date }) {
  const todayKey = iso(today);
  const existing = sessionOn(state, today);
  const draft = state.draft?.date === todayKey ? state.draft : null;
  const comeback = inComeback(state, today);
  const coming = planForDate(state, today);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoNote, setPhotoNote] = useState("");

  if (!draft && !existing && !canTrain(state, today)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">التمرين</h1>
        <Card className="p-4">
          <p className="font-medium">اليوم راحة</p>
          <p className="mt-1 text-sm text-muted">
            الأربعاء والسبت راحة. إذا فاتتك حصة، تمارينها تنتقل لليوم الذي تحضر فيه، بالترتيب نفسه.
          </p>
        </Card>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">التمرين</h1>
        <p className="text-sm text-muted">جدول بيور جيم: خمس حصص، أجهزة فقط، مع مشي في البداية.</p>
        {DAY_PLAN[today.getDay()] !== coming ? (
          <Card className="p-4 text-sm text-teal">اليوم تأخذ {PLAN_TITLE[coming]}. الترتيب لا يتخطى حصة فائتة.</Card>
        ) : null}
        {comeback ? (
          <Card className="p-4 text-sm text-flame">
            رجوع: مجموعتان فقط لكل تمرين، والوزن المقترح أخف بحوالي 15 بالمئة.
          </Card>
        ) : null}
        {existing ? (
          <Card className="p-4">
            <p className="font-medium">سجّلت {PLAN_TITLE[existing.plan]} اليوم</p>
            <p className="mt-1 text-sm text-muted">
              {existing.kind === "min" ? "جلسة قصيرة" : "جلسة كاملة"} · الأسبوع{" "}
              <span dir="ltr">{Math.min(weekProgress(state, today), state.gymDays.length)}/{state.gymDays.length}</span>
            </p>
            <Btn className="mt-4 w-full" variant="ghost" onClick={() => setDraft(draftFromSession(existing))}>
              تعديل تسجيل اليوم
            </Btn>
            {confirmDelete ? (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-sm">يمسح حضور اليوم فقط.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>
                    إلغاء
                  </Btn>
                  <Btn
                    variant="flame"
                    onClick={() => {
                      cancelRest();
                      deleteToday(todayKey);
                      setConfirmDelete(false);
                    }}
                  >
                    احذف الحضور
                  </Btn>
                </div>
              </div>
            ) : (
              <Btn variant="quiet" className="mt-2 px-0 text-flame" onClick={() => setConfirmDelete(true)}>
                احذف حضور اليوم
              </Btn>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <Btn className="w-full" onClick={() => setDraft(createDraft(state, today, "full"))}>
              ابدأ الجلسة الكاملة
            </Btn>
            <Btn className="w-full" variant="ghost" onClick={() => setDraft(createDraft(state, today, "min"))}>
              جلسة قصيرة
            </Btn>
            <p className="text-sm text-muted">إحماء وجهازان. تحسب حضورًا وتحمي الستريك.</p>
          </div>
        )}
      </div>
    );
  }

  const log = draft.logs[draft.step];
  if (!log) return null;
  const def = slotFor(draft.plan, log.exerciseId);
  const lastStep = draft.step === draft.logs.length - 1;
  const ceiling = repCeiling(def.reps);
  const bump = def.kind === "strength" && !comeback && readyToBump(state, def.id, ceiling);

  function finish() {
    if (!draft) return;
    cancelRest();
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
            {draft.step + 1} من {draft.logs.length}
          </h1>
        </div>
        <p className="text-sm text-muted">{def.kind === "walk" ? "كارديو" : def.reps}</p>
      </div>
      <Card className="overflow-hidden">
        <MachinePhoto image={def.image} photos={state.photos} alt={def.name} />
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-semibold">{def.name}</h2>
            <PhotoPick
              facing="environment"
              label="صورة جهازي"
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm text-muted"
              max={960}
              quality={0.72}
              onFail={setPhotoNote}
              onImage={(url) => {
                setPhotoNote("");
                update((current) => ({
                  ...current,
                  photos: { ...current.photos, [def.image]: url },
                }));
              }}
            />
          </div>
          {photoNote ? <p className="text-sm text-flame">{photoNote}</p> : null}
          {def.cue ? <p className="text-sm text-muted">{def.cue}</p> : null}
          {def.kind === "strength" && def.reps ? (
            <p className="text-sm text-muted">
              <span dir="ltr">{def.reps}</span>
              {def.rest ? (
                <>
                  {" "}
                  · راحة <span dir="ltr">{def.rest}</span> ث
                </>
              ) : null}
            </p>
          ) : null}
          {bump ? (
            <p className="text-sm text-teal">وصلت أعلى المدى في حصتين. ارفع الوزن درجة صغيرة.</p>
          ) : null}
          {def.kind === "walk" && log.walk ? (
            <div className="flex flex-col gap-3">
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
                <div key={index} className="flex flex-col gap-2 rounded-xl bg-raised/40 p-2">
                  <span className="text-sm text-muted">مجموعة {index + 1}</span>
                  <div className="grid grid-cols-1 gap-2">
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
              {def.rest ? (
                <RestStart exerciseKey={`${draft.date}:${draft.plan}:${def.id}`} name={def.name} seconds={def.rest} />
              ) : null}
            </div>
          )}
          {def.id === "walk-out" ? (
            <Btn
              variant="ghost"
              onClick={() => {
                const logs = draft.logs.filter((_, index) => index !== draft.step);
                if (draft.step >= logs.length) {
                  cancelRest();
                  saveSession({
                    id: `${draft.date}-${draft.plan}`,
                    date: draft.date,
                    plan: draft.plan,
                    kind: draft.kind,
                    exercises: logs,
                  });
                  return;
                }
                setDraft({ ...draft, logs, step: Math.min(draft.step, logs.length - 1) });
              }}
            >
              تخطّ المشي
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
  const [shotError, setShotError] = useState("");
  const [openShot, setOpenShot] = useState<BodyShot | null>(null);
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
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-lg font-semibold">صورة الجسم</h2>
        <p className="text-sm text-muted">
          مرة في الأسبوع، ويفضّل الجمعة. نفس المسافة، نفس الإضاءة، ونفس الوقفة. الصورة تبقى على الجهاز.
        </p>
        <PhotoPick
          facing="user"
          label="صوّر هذا الأسبوع"
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-teal px-4 text-fg"
          max={720}
          quality={0.66}
          onFail={setShotError}
          onImage={(image) => {
            saveBodyShot({ date: key, image });
            setShotError("");
          }}
        />
        {shotError ? <p className="text-sm text-flame">{shotError}</p> : null}
        {state.bodyShots.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1" dir="ltr">
            {[...state.bodyShots]
              .sort((a, b) => (a.date < b.date ? -1 : 1))
              .map((shot) => (
                <button key={shot.date} type="button" className="shrink-0" onClick={() => setOpenShot(shot)}>
                  <img src={shot.image} alt="" className="h-28 w-20 rounded-xl object-cover" />
                  <span className="mt-1 block text-center text-[10px] text-muted" dir="ltr">
                    {shot.date.slice(5)}
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted">بعد أول صورة يظهر الشريط من الأقدم إلى الأحدث.</p>
        )}
      </Card>
      {openShot ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-bg/95 p-5" role="dialog">
          <button type="button" className="mb-3 self-start text-sm text-muted" onClick={() => setOpenShot(null)}>
            إغلاق
          </button>
          <img src={openShot.image} alt="" className="max-h-[70dvh] w-full rounded-2xl object-contain" />
          <p className="mt-3 text-center text-sm text-muted" dir="ltr">
            {openShot.date}
          </p>
        </div>
      ) : null}
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

export function SettingsView({ state, onTab }: { state: JeetState; onTab: (tab: TabId) => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState(false);
  const [perm, setPerm] = useState("");

  useEffect(() => {
    const read = () => setPerm(androidBridge()?.notifyStatus?.() ?? "");
    read();
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">الإعدادات</h1>
      <Card className="p-4">
        <p className="font-medium">جدول الأسبوع</p>
        <p className="mt-1 text-sm text-muted">
          ثابت على أيام بيور جيم. إذا فاتك يوم، تمارينه تنتقل لليوم الذي تحضر فيه دون تخطي الترتيب. الأربعاء والسبت للتعويض.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {[
            ["الأحد", "دفع · صدر وكتف وترايسِبس"],
            ["الاثنين", "سحب · ظهر وبايسبس"],
            ["الثلاثاء", "أرجل وسمانة"],
            ["الأربعاء", "راحة"],
            ["الخميس", "علوي كامل"],
            ["الجمعة", "سفلي كامل · يوم القياس"],
            ["السبت", "راحة"],
          ].map(([day, title]) => (
            <li key={day} className="flex items-center justify-between gap-3">
              <span>{day}</span>
              <span className="text-muted">{title}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">تذكير أيام النادي</p>
          <button
            type="button"
            role="switch"
            aria-checked={state.reminders}
            onClick={() => update((current) => ({ ...current, reminders: !current.reminders }))}
            className={`h-8 w-14 rounded-full px-1 ${state.reminders ? "bg-teal" : "bg-raised"}`}
          >
            <span className={`block size-6 rounded-full bg-fg ${state.reminders ? "ms-auto" : ""}`} />
          </button>
        </div>
        <p className="text-sm text-muted">إشعار في أيام الحصص الخمس فقط. والجمعة إشعار إضافي للقياس والصورة.</p>
        <label className="flex flex-col gap-2 text-sm text-muted">
          وقت النادي
          <input
            type="time"
            value={state.reminder}
            onChange={(event) => update((current) => ({ ...current, reminder: event.target.value }))}
            className="h-12 rounded-xl border border-line bg-raised px-3 text-base text-fg"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted">
          جمعة القياس
          <input
            type="time"
            value={state.measureTime}
            onChange={(event) => update((current) => ({ ...current, measureTime: event.target.value }))}
            className="h-12 rounded-xl border border-line bg-raised px-3 text-base text-fg"
          />
        </label>
        <Btn
          variant="ghost"
          onClick={() => {
            const bridge = androidBridge();
            if (!bridge) return;
            if (perm === "denied") bridge.openNotifySettings?.();
            else bridge.requestNotify?.();
          }}
        >
          {perm === "granted" ? "الإشعارات مسموحة" : perm === "denied" ? "افتح إعداد الإشعارات" : "السماح بالإشعارات"}
        </Btn>
        {androidBridge() ? null : (
          <p className="text-sm text-muted">إذن الإشعارات يظهر بعد تثبيت نسخة الجوال.</p>
        )}
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
              event.target.value = "";
              if (!file) return;
              try {
                const parsed = JSON.parse(await file.text()) as JeetState;
                if (!parsed || typeof parsed !== "object") throw new Error("bad");
                replaceState(parsed);
                setImportError(false);
              } catch {
                setImportError(true);
              }
            }}
          />
        </label>
        {importError ? <p className="text-sm text-flame">الملف ليس نسخة جيت.</p> : null}
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

