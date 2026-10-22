import { useMemo, useRef, useState } from "react";
import { attendanceWeeks, iso, parseDate, reportModel, type ReportModel } from "./logic";
import { androidBridge } from "./native";
import { FileDown, Ruler, TrendingUp } from "./icons";
import { Btn, Card, EmptyState, PageTitle, Pill, Toggle } from "./ui";
import type { JeetState } from "./types";

function Line({ rows, field }: { rows: ReportModel["measures"]; field: "waist" | "weight" }) {
  if (rows.length < 2) return <p className="form-note" style={{ marginTop: 20 }}>بعد قياسين يظهر مسار تقدمك هنا.</p>;
  const values = rows.map((row) => row[field]), min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1), from = parseDate(rows[0].date).getTime(), days = Math.max(1, parseDate(rows.at(-1)!.date).getTime() - from);
  const points = rows.map((row) => `${18 + (parseDate(row.date).getTime() - from) / days * 284},${22 + (max - row[field]) / span * 92}`).join(" ");
  return <div className="chart-block"><svg viewBox="0 0 320 138" role="img" aria-label={`${field === "waist" ? "الخصر" : "الوزن"} من ${values[0]} إلى ${values.at(-1)}`} style={{ width: "100%", height: 140 }}><path d="M18 22H302M18 68H302M18 114H302" stroke="var(--color-line)" strokeDasharray="3 5" /><polyline points={points} fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />{rows.map((row, i) => { const [x, y] = points.split(" ")[i].split(","); return <circle key={row.date} cx={x} cy={y} r="3" fill="var(--color-bg)" stroke="var(--color-teal)" strokeWidth="2" />; })}</svg><div className="chart-labels" dir="ltr"><span>{rows[0].date.slice(5)}</span><span>{min} — {max}</span><span>{rows.at(-1)!.date.slice(5)}</span></div></div>;
}
function ReportSheet({ model, photos }: { model: ReportModel; photos: boolean }) {
  return <article dir="rtl" style={{ width: 794, padding: 38, background: "#f6f7f0", color: "#14211b", fontFamily: '"IBM Plex Sans Arabic",sans-serif', fontSize: 14, lineHeight: 1.8 }}>
    <p style={{ color: "#4d643b" }}>جيت · كل حصة، خطوة.</p><h1 style={{ fontSize: 34, marginBlock: 12 }}>تقرير تقدمي</h1><p>{model.generated} · الأيام: {model.gymDays.join("، ")}</p>
    <h2 style={{ marginTop: 26 }}>الحضور والاستمرارية</h2><p>هذا الأسبوع {model.done} من {model.target} حصص · الاستمرارية {model.streak} أسابيع</p>
    <p>{model.weeks.map((week) => `${week.start}: ${week.count} حصص`).join(" | ")}</p>
    <h2 style={{ marginTop: 26 }}>القياسات</h2>{model.measures.length ? model.measures.map((row) => <p key={row.date}>{row.date} · الخصر {row.waist} سم · الوزن {row.weight} كغ</p>) : <p>لم تُسجل قياسات في الفترة المختارة.</p>}
    <h2 style={{ marginTop: 26 }}>الأوزان المسجلة</h2>{model.lifts.map((lift) => <p key={lift.name}>{lift.name}: آخر وزن {lift.last ?? "—"} كغ · قبله {lift.prev ?? "—"} كغ</p>)}
    <h2 style={{ marginTop: 26 }}>تفاصيل الحصص</h2>{model.sessions.map((session) => <section key={session.date} style={{ marginTop: 16, borderTop: "1px solid #d4dacd", paddingTop: 10 }}><h3>{session.date} · {session.plan} · {session.kind === "min" ? "مختصرة" : "كاملة"}</h3>{session.exercises.map((exercise, index) => <p key={index}>{exercise.name}: {exercise.walk ? `${exercise.walk.minutes} دقيقة · سرعة ${exercise.walk.speed} · ميل ${exercise.walk.incline}` : exercise.sets.map((set, i) => `ج${i + 1}: ${set.kg ?? "—"} كغ × ${set.reps ?? "—"}`).join(" | ")}</p>)}</section>)}
    {photos && model.shots.length ? <><h2 style={{ marginTop: 26 }}>صور التقدم</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 15 }}>{model.shots.map((shot) => <figure key={shot.date} style={{ width: 140, margin: 0 }}><img src={shot.image} alt="" style={{ width: 140, height: 185, objectFit: "cover", borderRadius: 10 }} /><figcaption>{shot.date}</figcaption></figure>)}</div></> : null}
    <p style={{ marginTop: 28, fontSize: 12, color: "#58604f" }}>{model.weak ? "البيانات محدودة، ولا تكفي لاستنتاج تقدم مؤكد." : "هذا التقرير يعرض الأداء المسجل؛ لا يفترض أداء لم يُسجل."} الجداول قابلة للتعديل حسب قدرة المستخدم وتوجيهات المدرب. لا يتضمن التقرير تشخيصًا أو نصيحة علاجية.</p>
  </article>;
}
async function exportPdf(node: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const host = node.parentElement, previous = host?.getAttribute("style") ?? "";
  try {
    if (host) Object.assign(host.style, { position: "fixed", left: "0", top: "0", width: "794px", height: "auto", overflow: "visible", visibility: "visible", zIndex: "-1" });
    await document.fonts.ready;
    await Promise.all([...node.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)));
    const height = Math.ceil(node.scrollHeight), pagePixels = Math.floor(794 * 297 / 210), pages = Math.ceil(height / pagePixels);
    if (pages > 60) throw new Error("التقرير كبير جدًا. اختر فترة أقصر، أو صدّر نسخة البيانات كاملة من الإعدادات.");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    // Tile the capture; never allocate a canvas as tall as the entire history.
    for (let page = 0; page < pages; page++) {
      const slice = Math.min(pagePixels, height - page * pagePixels);
      const canvas = await html2canvas(node, { scale: 1.5, backgroundColor: "#f6f7f0", width: 794, height: slice, y: page * pagePixels, windowWidth: 794 });
      if (page) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 210, slice * 210 / 794);
      canvas.width = 1; canvas.height = 1;
    }
    const bridge = androidBridge();
    if (bridge?.sharePdf) { const data = pdf.output("datauristring").split(",")[1]; if (!data || bridge.sharePdf(data, filename) !== "ok") throw new Error("تعذّر مشاركة التقرير."); }
    else pdf.save(filename);
  } finally { if (host) host.setAttribute("style", previous); }
}
export function StatsView({ state, today, onMeasure }: { state: JeetState; today: Date; onMeasure: () => void }) {
  const [period, setPeriod] = useState(8), [photos, setPhotos] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [compare, setCompare] = useState(false);
  const sheet = useRef<HTMLDivElement>(null), dateKey = iso(today);
  const model = useMemo(() => { const full = reportModel(state, parseDate(dateKey)); if (!period) return full; const from = new Date(parseDate(dateKey)); from.setDate(from.getDate() - period * 7); const key = iso(from); return { ...full, measures: full.measures.filter((row) => row.date >= key), sessions: full.sessions.filter((row) => row.date >= key), shots: full.shots.filter((row) => row.date >= key) }; }, [state, dateKey, period]);
  const weeks = attendanceWeeks(state, today), latest = model.measures.at(-1), earliest = model.measures[0], shots = [...state.bodyShots].sort((a, b) => a.date.localeCompare(b.date));
  const [left, setLeft] = useState(shots[0]?.date ?? ""), [right, setRight] = useState(shots.at(-1)?.date ?? "");
  const max = Math.max(model.target, ...weeks.map((row) => row.count), 1);
  return <div className="page-stack"><PageTitle eyebrow="أثر كل خطوة" title="تقدمي" subtitle="حضورك أولًا. الأرقام تحكي الباقي مع الوقت." action={<button className="icon-button" aria-label="تسجيل قياس" onClick={onMeasure}><Ruler size={21} /></button>} />
    <div className="segmented" aria-label="الفترة الزمنية">{[[4, "شهر"], [8, "شهران"], [12, "٣ أشهر"], [0, "الكل"]].map(([value, label]) => <button key={value} aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => setPeriod(Number(value))}>{label}</button>)}</div>
    <Card><div className="section-heading"><h2>حضور يصنع الفرق</h2><Pill><bdi dir="ltr">{model.done}/{model.target}</bdi> هذا الأسبوع</Pill></div><div style={{ display: "flex", gap: 9, height: 148, alignItems: "flex-end", paddingTop: 10 }} dir="ltr">{weeks.map((week) => <div key={week.start} style={{ flex: 1, display: "flex", height: "100%", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}><span className="form-note">{week.count || ""}</span><div style={{ width: "100%", height: Math.max(7, week.count / max * 100), background: week.start === model.weekStart ? "var(--color-teal)" : week.count ? "#a8cb623d" : "var(--color-raised)", borderRadius: "7px 7px 3px 3px" }} /><span className="form-note" style={{ fontSize: 9 }}>{week.label}</span></div>)}</div><p className="form-note" style={{ marginTop: 16 }}>آخر ٨ أسابيع · كل يوم حضور يُحسب مرة واحدة.</p></Card>
    <Card><div className="section-heading"><h2>محيط الخصر</h2><Pill tone="blue">سم</Pill></div><div className="measure-numbers"><div><strong>{latest?.waist ?? "—"}</strong><span>آخر قياس في الفترة</span></div><div><strong style={{ fontSize: 24, paddingTop: 10 }}>{latest && earliest && latest !== earliest ? `${Math.round((latest.waist - earliest.waist) * 10) / 10}` : "—"}</strong><span>التغير خلال الفترة · سم</span></div></div><Line rows={model.measures} field="waist" /></Card>
    <Card><div className="section-heading"><h2>وزن الجسم</h2><Pill tone="muted">كغ</Pill></div><div className="measure-numbers"><div><strong>{latest?.weight ?? "—"}</strong><span>الوزن جزء من الصورة</span></div></div><Line rows={model.measures} field="weight" /></Card>
    {!state.measures.length ? <Btn variant="ghost" onClick={onMeasure}><Ruler size={18} />سجّل أول قياس</Btn> : null}
    <Card><div className="section-heading"><h2>أوزانك على الأجهزة</h2><TrendingUp size={20} className="muted" /></div>{model.lifts.filter((lift) => lift.last !== null).length ? model.lifts.filter((lift) => lift.last !== null).map((lift) => <div className="history-row" key={lift.name}><div style={{ flex: 1 }}><h3>{lift.name}</h3><p>{lift.prev === null ? "أول وزن مسجل" : `قبله ${lift.prev} كغ`}</p></div><strong className="numeric">{lift.last} <small className="muted" style={{ fontWeight: 400 }}>كغ</small></strong></div>) : <EmptyState icon="TrendingUp" title="كل قوة تبدأ بأول مجموعة" text="أكد مجموعاتك وأوزانك أثناء التدريب، وتابعها هنا." />}</Card>
    <Card><div className="section-heading"><h2>صور التقدم</h2>{shots.length >= 2 ? <button className="text-button" onClick={() => setCompare(!compare)}>{compare ? "عرض الشريط" : "قارن صورتين"}</button> : null}</div>{compare && shots.length >= 2 ? <div className="form-grid">{[[left, setLeft, "الصورة الأولى"], [right, setRight, "الصورة الثانية"]].map(([date, setDate, label], index) => { const chosen = shots.find((shot) => shot.date === date) ?? shots[index ? shots.length - 1 : 0]; return <div key={index}><label className="form-field">{label as string}<select value={chosen.date} onChange={(event) => (setDate as (date: string) => void)(event.target.value)}>{shots.map((shot) => <option key={shot.date}>{shot.date}</option>)}</select></label><img src={chosen.image} alt={label as string} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 13, marginTop: 12 }} /></div>; })}</div> : shots.length ? <div className="photo-strip" dir="ltr">{shots.slice(-8).map((shot) => <figure key={shot.date}><img src={shot.image} alt={`صورة تقدم ${shot.date}`} /><figcaption>{shot.date}</figcaption></figure>)}</div> : <p className="form-note">أضف صورك من صفحة القياسات، وستظهر هنا للمقارنة.</p>}</Card>
    <Card className="settings-group"><h2>تقريرك، وقت ما تحتاجه</h2><p className="form-note">يتضمن الحضور والقياسات وتفاصيل الحصص في الفترة المختارة. يشمل ملخص الأوزان آخر سجل متاح لكل تمرين.</p><Toggle checked={photos} label="إدراج صور الجسم" description="فعّلها فقط إذا أردت مشاركة الصور داخل التقرير." onChange={() => setPhotos(!photos)} /><Btn disabled={busy} onClick={async () => { if (!sheet.current) return; setBusy(true); setError(""); try { await exportPdf(sheet.current, `jeet-${dateKey}.pdf`); } catch (e) { setError(e instanceof Error ? e.message : "تعذّر تجهيز التقرير."); } finally { setBusy(false); } }}><FileDown size={18} />{busy ? "نجهّز تقريرك…" : "تصدير تقرير PDF"}</Btn>{error ? <p className="form-error" role="alert">{error}</p> : null}</Card>
    <Card><div className="section-heading"><h2>حصص الفترة</h2><span>{model.sessions.length} حصة</span></div>{model.sessions.length ? model.sessions.map((session) => <div className="history-row" key={session.date}><div className="history-date">{session.date.slice(-2)}<small>{session.date.slice(5, 7)}</small></div><div><h3>{session.plan}</h3><p>{session.exercises.length} تمارين · {session.kind === "min" ? "مختصرة" : "كاملة"}</p></div><Pill tone="muted">{session.date}</Pill></div>) : <p className="form-note">بعد أول حصة، يبدأ سجلك هنا.</p>}</Card>
    <div aria-hidden="true" style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", visibility: "hidden" }}><div ref={sheet}><ReportSheet model={model} photos={photos} /></div></div>
    {busy ? <div className="modal-backdrop" role="status" style={{ alignItems: "center", padding: 30 }}><Card><h2>نجهّز تقريرك…</h2><p className="form-note">قد يستغرق قليلًا إذا كانت الفترة طويلة أو تشمل الصور.</p></Card></div> : null}
  </div>;
}
