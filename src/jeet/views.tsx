import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Dumbbell, Flame, Pencil, Play, Ruler, ShieldCheck, Timer, Trash2, TrendingUp } from "./icons";
import { canTrain, createDraft, draftFromSession, inComeback, iso, motivation, planForDate, readyToBump, repCeiling, sessionOn, suggestKg, targetForWeek, weekdayChips, weekProgress } from "./logic";
import { defById, estimatedMinutes, planTitle, slotsFor } from "./plan";
import { deleteToday, saveSession, setDraft, update } from "./store";
import { cancelRest, startRest } from "./rest-timer";
import { RestStart } from "./rest-timer-ui";
import { Btn, Card, Confirm, MachinePhoto, PageTitle, Pill, Field, Modal } from "./ui";
import { PhotoPick } from "./personal";
import { androidBridge } from "./native";
import type { Draft, ExerciseLog, JeetState, SessionKind } from "./types";
export { MeasureView, SettingsView } from "./personal";

export function HomeView({ state, today, onTrain, onMeasure, onPlans }: { state: JeetState; today: Date; onTrain: () => void; onMeasure: () => void; onPlans: () => void }) {
  const done = weekProgress(state, today), target = targetForWeek(state, today), attended = sessionOn(state, today), active = state.draft;
  const planId = active?.plan ?? planForDate(state, today), exercises = slotsFor(planId, "full", state), name = active?.planName ?? attended?.planName ?? planTitle(state, planId);
  const trainable = canTrain(state, today), [deleting, setDeleting] = useState(false);
  return <div className="page-stack">
    <div><p className="welcome-date">{today.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long", calendar: "gregory" })}</p><h1 className="welcome-title">{attended ? <>جيت، <span>وأنجزت.</span></> : <>كل حصة،<br /><span>نسخة أقوى منك.</span></>}</h1></div>
    <Card className="workout-hero"><div className="hero-art"><Dumbbell size={84} strokeWidth={1.2} /></div><div className="hero-copy"><Pill tone={attended ? "green" : trainable ? "green" : "blue"}>{attended ? <><Check size={13} />حضور اليوم محسوب</> : active ? "حصتك بانتظارك" : trainable ? "حصتك القادمة" : "اليوم راحة"}</Pill><h2>{!trainable && !attended ? "اشحن طاقتك" : name}</h2><p>{!trainable && !attended ? "التعافي جزء من الطريق. خطتك تنتظرك في يومك القادم." : state.plans.find((plan) => plan.id === planId)?.description || "حصة بخطوات واضحة، وعلى إيقاعك."}</p><div className="hero-meta"><span><Dumbbell size={15} />{exercises.length} تمارين</span><span><Timer size={15} />نحو {estimatedMinutes(exercises)} دقيقة</span></div></div><Btn onClick={onTrain}>{attended ? "عرض حصة اليوم" : active ? `استكمل الحصة · ${active.step + 1}/${active.logs.length}` : trainable ? "يلا، نبدأ" : "استعرض تمرينك القادم"}{attended ? <Check size={18} /> : <ChevronLeft size={20} />}</Btn></Card>
    <Card><div className="section-heading"><h2>أسبوعك، خطوة بخطوة</h2><span className="numeric" dir="ltr"><strong style={{ color: "var(--color-teal)", fontSize: 20 }}>{done}</strong> / {target}</span></div><div className="weekdays">{weekdayChips(today).map((day) => { const hit = Boolean(sessionOn(state, day)), current = iso(day) === iso(today); return <div className="week-day" key={iso(day)}><span>{day.toLocaleDateString("ar", { weekday: "short" })}</span><div className={`day-circle ${hit ? "done" : current ? "today" : state.gymDays.includes(day.getDay()) ? "scheduled" : ""}`} aria-label={`${iso(day)}${hit ? " تم التدريب" : current ? " اليوم" : ""}`}>{hit ? <Check size={16} /> : day.getDate()}</div></div>; })}</div><div className="weekly-footer"><span>{done >= target ? "اكتمل هدف الأسبوع. أحسنت!" : `باقي ${target - done} ${target - done === 1 ? "حصة" : "حصص"} على هدفك`}</span><button className="text-button" style={{ minHeight: 0 }} onClick={onPlans}>تعديل الأيام<ChevronLeft size={12} /></button></div></Card>
    <div className="stats-grid"><div className="stat-tile"><Dumbbell size={19} /><strong className="numeric">{state.sessions.length}</strong><span>حصة في رصيدك</span></div><div className="stat-tile"><Flame size={19} style={{ color: "var(--color-flame)" }} /><strong className="numeric">{state.streak}</strong><span>أسابيع استمرارية</span></div><div className="stat-tile"><TrendingUp size={19} /><strong className="numeric">{state.measures.length}</strong><span>قياسات للتقدم</span></div></div>
    <Card className="insight-card"><span className="insight-icon"><Flame size={22} /></span><div><h3>{state.ember ? "العودة تبدأ بحصة" : "قليل، لكن باستمرار"}</h3><p>{motivation(state, today)}</p></div></Card>
    <Card className="insight-card"><span className="insight-icon" style={{ color: "var(--color-teal)", background: "#d2f36b0c" }}><Ruler size={22} /></span><div style={{ flex: 1 }}><h3>التقدم أكثر من رقم</h3><p>سجّل الوزن والخصر وصورة دورية، وقارن نفسك بنفسك.</p><button className="text-button" onClick={onMeasure}>سجّل قياسك<ArrowUpRight size={14} /></button></div></Card>
    {!state.sessions.length ? <button className="text-button" style={{ justifyContent: "center" }} onClick={onPlans}><Pencil size={15} />خصص خطتك قبل أول حصة</button> : null}
    {attended ? <button className="text-button" style={{ color: "var(--color-muted)", justifyContent: "center" }} onClick={() => setDeleting(true)}>سجّلت بالغلط؟ حذف حضور اليوم</button> : null}
    {deleting ? <Confirm title="حذف حضور اليوم؟" text="تُحذف هذه الحصة وأوزانها فقط، ويعود ترتيب الحصص خطوة." action="حذف الحضور" danger onClose={() => setDeleting(false)} onConfirm={() => { if (deleteToday(iso(today))) { cancelRest(); setDeleting(false); } }} /> : null}
  </div>;
}

export function TrainView({ state, today, onLeave }: { state: JeetState; today: Date; onLeave: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState(planForDate(state, today)), [optional, setOptional] = useState(false), [note, setNote] = useState(""), [confirm, setConfirm] = useState<"finish" | "discard" | null>(null), [photo, setPhoto] = useState(false);
  const draft = state.draft, existing = sessionOn(state, today), todayKey = iso(today);
  useEffect(() => { if (!draft) setSelectedPlan(planForDate(state, today)); }, [state.sessions, state.plans, todayKey, draft, state, today]);
  const start = (kind: SessionKind) => { setNote(""); if (setDraft(createDraft(state, today, kind, selectedPlan)) && androidBridge()?.notifyStatus?.() === "default") androidBridge()?.requestNotify?.(); };
  if (!draft) {
    const exercises = slotsFor(selectedPlan, "full", state);
    return <div className="page-stack"><PageTitle eyebrow="وقت لنفسك" title={existing ? "حصة اليوم اكتملت" : "جاهز لحصتك؟"} subtitle={existing ? "خطوة جديدة في رصيدك. كل التفاصيل محفوظة." : "ابدأ بهدوء. سجل كل مجموعة، وخذ راحتك بينها."} />
      {existing ? <Card><div className="empty-state"><span className="empty-icon"><Check size={32} /></span><h2>{existing.planName ?? planTitle(state, existing.plan)}</h2><p>{existing.kind === "min" ? "جلسة قصيرة" : "جلسة كاملة"} · {existing.exercises.length} تمارين{existing.durationMinutes ? ` · ${existing.durationMinutes} دقيقة` : ""}</p><Btn onClick={() => setDraft(draftFromSession(existing))}><Pencil size={17} />تعديل تسجيل اليوم</Btn></div></Card> : <>
        {!canTrain(state, today) && !optional ? <Card><div className="empty-state"><span className="empty-icon"><CalendarDays size={30} /></span><h2>مساحة للتعافي</h2><p>اليوم خارج أيام تدريبك أو أن هدف الأسبوع اكتمل. يمكنك استعراض حصتك القادمة أو بدء حصة اختيارية.</p><Btn variant="ghost" onClick={() => setOptional(true)}>أريد التدريب اليوم</Btn></div></Card> : null}
        <Card><label className="form-field">جدول الحصة<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)}>{state.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><div className="hero-meta" style={{ marginBlock: "16px 20px" }}><span><Dumbbell size={16} />{exercises.length} تمارين</span><span><Timer size={16} />نحو {estimatedMinutes(exercises)} دقيقة</span></div><div className="exercise-list">{exercises.map((exercise, index) => <div className="exercise-row" style={{ background: "var(--color-bg)" }} key={exercise.id}><span className="exercise-thumbnail">{String(index + 1).padStart(2, "0")}</span><div className="exercise-info"><h3>{exercise.name}</h3><p>{exercise.kind === "walk" ? `${exercise.walk?.minutes ?? 6} دقائق` : <>{exercise.sets} مجموعات · <bdi dir="ltr">{exercise.reps}</bdi> تكرار · راحة {exercise.rest ?? 90} ث</>}</p></div></div>)}</div></Card>
        {inComeback(state, today) ? <p className="exercise-cue">رجوع أخف: مجموعتان ووزن مقترح أقل من حصتك العادية. عدّل الوزن حسب قدرتك.</p> : null}
        {canTrain(state, today) || optional ? <><Btn className="full-width" onClick={() => start("full")}><Play size={18} />ابدأ الحصة</Btn><Btn variant="ghost" onClick={() => start("min")}>وقتي ضيق · جلسة مختصرة</Btn><p className="form-note" style={{ textAlign: "center" }}>المختصرة تأخذ الإحماء وأول تمرينين للقوة، وتحسب حضورًا.</p></> : null}
      </>}
    </div>;
  }
  const log = draft.logs[draft.step], def = log?.definition ?? defById(log?.exerciseId ?? "", state);
  if (!log) return <p className="form-error">تعذّر فتح الحصة. يمكنك استعادة نسخة البيانات من الإعدادات.</p>;
  const key = `${draft.date}:${draft.plan}:${def.id}`, last = draft.step === draft.logs.length - 1, rest = def.kind === "strength" ? def.rest ?? 90 : 0;
  const patchLog = (next: ExerciseLog) => setDraft({ ...draft, logs: draft.logs.map((item, index) => index === draft.step ? next : item) });
  const completed = draft.logs.reduce((total, item) => total + item.sets.filter((set) => set.done !== false && set.reps !== null).length + (item.completed && item.walk ? 1 : 0), 0);
  const total = draft.logs.reduce((sum, item) => sum + (item.walk ? 1 : item.sets.length), 0);
  const finish = (current = draft) => {
    const exercises = current.logs.map((item) => ({ ...item, sets: item.sets.filter((set) => set.done !== false && set.reps !== null) })).filter((item) => item.walk ? item.completed : item.sets.length > 0);
    if (!exercises.length) { setNote("أكد مجموعة واحدة أو أكمل الإحماء قبل حفظ الحصة."); setConfirm(null); return; }
    const previous = state.sessions.find((session) => session.date === current.date);
    const saved = saveSession({ id: `${current.date}-${current.plan}`, date: current.date, plan: current.plan, planName: current.planName ?? planTitle(state, current.plan), kind: current.kind, comeback: current.comeback, durationMinutes: current.startedAt ? Math.min(1440, Math.max(1, Math.round((Date.now() - current.startedAt) / 60000))) : previous?.durationMinutes, exercises });
    if (saved) { cancelRest(); setConfirm(null); }
  };
  const next = () => {
    const current = log.walk ? { ...draft, logs: draft.logs.map((item, index) => index === draft.step ? { ...item, completed: true } : item) } : draft;
    const actual = current.logs.reduce((sum, item) => sum + item.sets.filter((set) => set.done !== false && set.reps !== null).length + (item.completed && item.walk ? 1 : 0), 0);
    setNote("");
    if (last) { if (actual < total) { if (log.walk && !setDraft(current)) return; setConfirm("finish"); } else finish(current); }
    else setDraft({ ...current, step: current.step + 1 });
  };
  const mark = (index: number) => {
    const set = log.sets[index];
    if (!set.done && (!set.reps || (set.kg === null && def.equipment !== "وزن الجسم"))) { setNote("أدخل الوزن والتكرارات، ثم اضغط علامة الصح لتأكيد المجموعة."); return; }
    const done = set.done === false || set.done === undefined;
    if (patchLog({ ...log, sets: log.sets.map((item, i) => i === index ? { ...item, done } : item) })) {
      setNote("");
      if (done && state.autoRest && rest) startRest(key, def.name, rest);
      else if (!done) cancelRest();
    }
  };
  return <div className="page-stack">
    <div className="session-topline"><Pill>{draft.planName ?? planTitle(state, draft.plan)}</Pill><button className="text-button" onClick={() => setConfirm("discard")}>إنهاء لاحقًا<ChevronLeft size={14} /></button></div>
    {draft.date !== todayKey ? <p className="exercise-cue">تستكمل حصة بدأت يوم <bdi>{draft.date}</bdi>. سيُحفظ حضورها في تاريخ بدايتها.</p> : null}
    <div><div className="section-heading" style={{ marginBottom: 10 }}><span>التمرين {draft.step + 1} من {draft.logs.length}</span><span><bdi dir="ltr">{completed}/{total}</bdi> مكتمل</span></div><div className="progress-track" role="progressbar" aria-label="تقدم الحصة" aria-valuenow={completed} aria-valuemax={total}><div className="progress-fill" style={{ width: `${total ? completed / total * 100 : 0}%` }} /></div></div>
    <div><MachinePhoto image={def.image || def.id} photos={state.photos} alt={def.name} /><div className="training-title"><h2>{def.name}</h2><button className="icon-button" aria-label="تغيير صورة الجهاز" onClick={() => setPhoto(true)}><Camera size={19} /></button></div><div className="hero-meta"><span>{def.kind === "walk" ? "إحماء وكارديو" : <>{log.sets.length} مجموعات · <bdi dir="ltr">{def.reps ?? "حسب قدرتك"}</bdi></>}</span>{def.kind === "strength" ? <span><Timer size={14} />راحة {def.rest ?? 90} ث</span> : null}</div></div>
    {def.cue ? <p className="exercise-cue">{def.cue}</p> : null}
    {def.kind === "strength" && !draft.comeback && readyToBump(state, def.id, repCeiling(def.reps)) ? <p className="exercise-cue">وصلت أعلى التكرارات بالوزن نفسه في حصتين. يمكنك تجربة زيادة صغيرة.</p> : null}
    {log.walk ? <Card><div className="form-stack"><Field label="المدة · دقيقة" value={log.walk.minutes} max={240} onChange={(minutes) => patchLog({ ...log, walk: { ...log.walk!, minutes: minutes ?? 0 } })} /><div className="form-grid"><Field label="السرعة" step="0.1" max={100} value={log.walk.speed} onChange={(speed) => patchLog({ ...log, walk: { ...log.walk!, speed: speed ?? 0 } })} /><Field label="الميل" step="0.5" max={50} value={log.walk.incline} onChange={(incline) => patchLog({ ...log, walk: { ...log.walk!, incline: incline ?? 0 } })} /></div></div></Card> : <Card>
      <div className="set-table-head"><span>جولة</span><span>الوزن · كغ</span><span>التكرارات</span><span>تم</span></div>
      {log.sets.map((set, index) => <div className={`set-row ${set.done ? "is-done" : ""}`} key={index}><span className="set-number">{index + 1}</span><Field label={`وزن المجموعة ${index + 1}`} step="0.5" value={set.kg} onChange={(kg) => patchLog({ ...log, sets: log.sets.map((item, i) => i === index ? { ...item, kg, done: false } : item) })} /><Field label={`تكرارات المجموعة ${index + 1}`} max={1000} value={set.reps} onChange={(reps) => patchLog({ ...log, sets: log.sets.map((item, i) => i === index ? { ...item, reps: reps === null ? null : Math.round(reps), done: false } : item) })} /><button className="set-check" aria-label={`${set.done ? "إلغاء تأكيد" : "تأكيد"} المجموعة ${index + 1}`} aria-pressed={Boolean(set.done)} onClick={() => mark(index)}><Check size={19} /></button></div>)}
      <div className="section-heading" style={{ margin: "12px 0 0" }}><button className="text-button" onClick={() => { const first = log.sets[0]; if (first) patchLog({ ...log, sets: log.sets.map((item, i) => i ? { ...first, done: false } : item) }); }}>نسخ أرقام الجولة الأولى</button><span>{suggestKg(state, def.id, today) !== null ? `آخر اقتراح ${suggestKg(state, def.id, today)} كغ` : "أول تسجيل"}</span></div>
    </Card>}
    {note ? <p className="form-error" role="alert">{note}</p> : null}
    {def.kind === "strength" && rest ? <RestStart exerciseKey={key} name={def.name} seconds={rest} /> : null}
    {log.walk ? <button className="text-button" style={{ justifyContent: "center" }} onClick={() => { if (last) { const current = { ...draft, logs: draft.logs.filter((_, i) => i !== draft.step) }; finish(current); } else setDraft({ ...draft, step: draft.step + 1 }); }}>تخطّ هذا الكارديو</button> : null}
    <div className="training-actions"><Btn variant="ghost" disabled={draft.step === 0} onClick={() => { setNote(""); setDraft({ ...draft, step: draft.step - 1 }); }}><ChevronRight size={19} /><span className="screen-reader">التمرين السابق</span></Btn><Btn onClick={next}>{last ? "إنهاء وحفظ الحصة" : log.walk ? "أكملت · التمرين التالي" : "التمرين التالي"}{last ? <Check size={18} /> : <ChevronLeft size={18} />}</Btn></div>
    <p className="form-note" style={{ textAlign: "center" }}><ShieldCheck size={13} style={{ display: "inline", verticalAlign: "middle" }} /> تُحفظ خطواتك تلقائيًا على جهازك. أكّد كل مجموعة بعد أدائها.</p>
    {confirm === "finish" ? <Confirm title="حفظ ما أنجزت؟" text="بعض المجموعات لم تُؤكد. نحفظ المجموعات المؤكدة فقط، وتُحسب الحصة حضورًا." action="حفظ الحصة" onClose={() => setConfirm(null)} onConfirm={() => finish()} /> : null}
    {confirm === "discard" ? <Modal title="حصتك محفوظة" description="يمكنك العودة وإكمالها لاحقًا، أو إلغاء المسودة وبدء حصة جديدة. الحصص المكتملة لا تتأثر." onClose={() => setConfirm(null)}><div className="form-stack"><Btn onClick={() => { cancelRest(); setConfirm(null); onLeave(); }}>احفظها لوقت لاحق</Btn><Btn variant="ghost" onClick={() => setConfirm(null)}>متابعة التمرين</Btn><Btn variant="quiet" onClick={() => { if (setDraft(null)) { cancelRest(); setConfirm(null); } }}><Trash2 size={17} />إلغاء هذه المسودة</Btn></div></Modal> : null}
    {photo ? <Modal title="صورة جهازك" description="التقط صورة للجهاز لتتعرف عليه بسهولة في حصتك القادمة." onClose={() => setPhoto(false)}><PhotoPick facing="environment" label="تصوير الجهاز" max={900} quality={0.68} onFail={setNote} onImage={(url) => { if (update((current) => ({ ...current, photos: { ...current.photos, [def.image || def.id]: url } }))) setPhoto(false); }} /></Modal> : null}
  </div>;
}
