import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FileDown } from "lucide-react";
import { PLAN_TITLE } from "./plan";
import { attendanceWeeks, iso, reportModel, type ReportModel } from "./logic";
import { androidBridge } from "./native";
import type { JeetState, PlanId } from "./types";
import { Btn, Card } from "./ui";

function Bars({ rows, max }: { rows: { start: string; label: string; count: number }[]; max: number }) {
  return (
    <div className="flex h-28 items-end gap-1.5" dir="ltr" aria-label="حضور ثمانية أسابيع">
      {rows.map((row) => (
        <div key={row.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-20 w-full items-end">
            <div
              className={`w-full rounded-t-md ${row.count ? "bg-teal" : "bg-line"}`}
              style={{ height: row.count ? `${Math.max(18, (row.count / max) * 100)}%` : "8px" }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function Line({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <p className="text-sm text-muted">بعد قياسين يظهر الخط.</p>;
  const width = 320;
  const height = 120;
  const pad = 12;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = pad + (index * (width - pad * 2)) / (values.length - 1);
      const y = pad + ((max - value) * (height - pad * 2)) / span;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" role="img" aria-label={label}>
      <polyline fill="none" stroke="var(--color-teal)" strokeWidth="3" points={points} />
    </svg>
  );
}

function sign(value: number | null, unit: string) {
  if (value === null) return "—";
  const prefix = value > 0 ? "+" : "";
  const text = `${prefix}${value}${unit ? ` ${unit}` : ""}`;
  return `\u202A${text}\u202C`;
}

const sheetStyle = {
  width: 794,
  background: "#F4F1EA",
  color: "#101412",
  fontFamily: '"IBM Plex Sans Arabic", sans-serif',
  padding: 36,
  boxSizing: "border-box" as const,
};

function ReportSheet({ model }: { model: ReportModel }) {
  const payload = {
    app: "jeet",
    generated: model.generated,
    attendance: { this_week: model.done, target: model.target, streak_weeks: model.streak, ember: model.ember },
    weeks: model.weeks,
    measures: model.measures,
    sessions: model.sessions,
    lifts: model.lifts,
    constraints: {
      days_per_week: 5,
      keep_split: "order is push, pull, legs, upper, lower. A missed day moves that plan to the next day you attend. Do not skip ahead.",
      machines_only: true,
      one_change_only: true,
      no_hormone_advice: true,
      if_data_weak: "say so, do not invent progress",
      body_photos: model.shots.map((shot) => shot.date),
    },
  };
  return (
    <div dir="rtl" style={sheetStyle}>
      <p style={{ margin: 0, color: "#1F6F64", fontSize: 14 }}>جيت</p>
      <h1 style={{ margin: "4px 0 0", fontSize: 32 }}>تقرير التدريب</h1>
      <p style={{ margin: "8px 0 0", color: "#5c675f" }}>
        {model.generated} · أسبوع {model.weekStart} · الأيام: {model.gymDays.join(" · ")}
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18 }}>قيود على أي تحليل</h2>
      <p style={{ lineHeight: 1.7 }}>
        خمس حصص بالترتيب: دفع ثم سحب ثم أرجل ثم علوي ثم سفلي. إذا فات يوم، حصته تنتقل ليوم الحضور ولا تُتخطى.
        الأربعاء والسبت راحة إلا للتعويض. أجهزة فقط لا أوزان حرة. تعديل واحد فقط. لا نصيحة هرمونات ولا تشخيص. إذا القياس أو
        الصور أو الأوزان ناقصة فقل ذلك ولا تخترع تقدماً.
      </p>

      <h2 style={{ fontSize: 18 }}>الحضور</h2>
      <p>
        هذا الأسبوع {model.done} من {model.target}. الستريك {model.streak} أسبوع
        {model.ember ? " (اللهب خافت)" : ""}. الوضع: {model.comeback ? "رجوع" : "عادي"}.
        {model.daysSince === null ? " لا يوجد حضور سابق." : ` آخر حضور قبل ${model.daysSince} يوم.`}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right", borderBottom: "1px solid #d9d3c7", padding: 6 }}>أسبوع من</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #d9d3c7", padding: 6 }}>أيام</th>
          </tr>
        </thead>
        <tbody>
          {model.weeks.map((week) => (
            <tr key={week.start}>
              <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{week.start}</td>
              <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{`\u202A${week.count} / ${model.target}\u202C`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18 }}>القياس</h2>
      {model.measures.length ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {["التاريخ", "الخصر سم", "فرق الخصر", "الوزن كغ", "فرق الوزن"].map((head) => (
                <th key={head} style={{ textAlign: "right", borderBottom: "1px solid #d9d3c7", padding: 6 }}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.measures.map((row) => (
              <tr key={row.date}>
                <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{row.date}</td>
                <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{row.waist}</td>
                <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{sign(row.waistDelta, "")}</td>
                <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{row.weight}</td>
                <td style={{ padding: 6, borderBottom: "1px solid #eee7dc" }}>{sign(row.weightDelta, "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>لا قياسات.</p>
      )}

      <h2 style={{ fontSize: 18 }}>الأجهزة</h2>
      {model.lifts.map((lift) => (
        <p key={lift.name} style={{ margin: "4px 0" }}>
          {lift.name}: آخر وزن {lift.last ?? "—"} · الذي قبله {lift.prev ?? "—"}
        </p>
      ))}

      <h2 style={{ fontSize: 18 }}>صور الجسم</h2>
      {model.shots.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {model.shots.map((shot) => (
            <figure key={shot.date} style={{ margin: 0, width: 120 }}>
              <img src={shot.image} alt="" style={{ width: 120, height: 160, objectFit: "cover", borderRadius: 8 }} />
              <figcaption style={{ fontSize: 12, color: "#5c675f" }}>{shot.date}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p>لا صور.</p>
      )}

      <h2 style={{ fontSize: 18 }}>الجلسات</h2>
      {model.sessions.length ? (
        model.sessions.map((session) => (
          <section key={`${session.date}-${session.plan}`} style={{ marginTop: 14 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {session.date} · {PLAN_TITLE[session.plan as PlanId] ?? session.plan} ·{" "}
              {session.kind === "min" ? "قصيرة" : "كاملة"}
            </p>
            {session.exercises.map((exercise, index) => (
              <p key={`${session.date}-${index}`} style={{ margin: "2px 0 2px 0", fontSize: 14 }}>
                {exercise.name}
                {exercise.walk
                  ? ` — ${exercise.walk.minutes} د · سرعة ${exercise.walk.speed} · ميل ${exercise.walk.incline}`
                  : exercise.sets.length
                    ? ` — ${exercise.sets
                        .map(
                          (set, setIndex) =>
                            `مجموعة ${setIndex + 1}: \u202A${set.kg ?? "—"} × ${set.reps ?? "—"}\u202C`,
                        )
                        .join("  ")}`
                    : ""}
              </p>
            ))}
          </section>
        ))
      ) : (
        <p>لا جلسات.</p>
      )}

      <h2 style={{ fontSize: 18 }}>بيانات رقمية</h2>
      <p style={{ fontSize: 13 }}>{model.weak ? "جودة البيانات ضعيفة." : "جودة البيانات كافية لمقارنة قصيرة."}</p>
      <pre
        dir="ltr"
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 11,
          lineHeight: 1.45,
          background: "#fff",
          padding: 12,
          borderRadius: 8,
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

async function exportReportPdf(node: HTMLElement, filename: string) {
  const host = node.parentElement;
  const previous = host?.getAttribute("style") ?? "";
  if (host) {
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "794px";
    host.style.zIndex = "40";
    host.style.pointerEvents = "none";
  }
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#f4f1ea",
      width: 794,
      windowWidth: 794,
    });
    if (canvas.width < 20 || canvas.height < 20) throw new Error("blank");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.85);
    let left = imgHeight;
    let position = 0;
    pdf.addImage(img, "JPEG", 0, position, pageWidth, imgHeight);
    left -= pageHeight;
    while (left > 8) {
      position = left - imgHeight;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, pageWidth, imgHeight);
      left -= pageHeight;
    }
    const base64 = pdf.output("datauristring").split(",")[1] ?? "";
    if (!base64) throw new Error("empty");
    const bridge = androidBridge();
    if (bridge?.sharePdf) {
      if (bridge.sharePdf(base64, filename) === "fail") throw new Error("share");
      return;
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    if (host) host.setAttribute("style", previous);
  }
}

export function StatsView({ state, today }: { state: JeetState; today: Date }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const weeks = attendanceWeeks(state, today);
  const model = reportModel(state, today);
  const measures = model.measures;
  const last = measures.at(-1);
  const prev = measures.length > 1 ? measures[measures.length - 2] : undefined;
  const lifts = model.lifts.filter((lift) => lift.last !== null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">إحصاء</h1>
        <p className="mt-1 text-sm text-muted">الحضور أولاً. الخصر هو رقم الجسم، والوزن تابع له.</p>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">الأسابيع</h2>
          <p className="text-sm tabular-nums text-muted">
            هذا الأسبوع <span dir="ltr">{model.done}/{model.target}</span>
          </p>
        </div>
        <Bars rows={weeks} max={Math.max(model.target, 1)} />
        {state.sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">بعد أول حضور يمتلئ العمود.</p>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">الخصر</h2>
          <p className="text-2xl font-semibold tabular-nums">{last ? `${last.waist}` : "—"}</p>
        </div>
        <p className="text-sm text-muted">
          {last && prev ? `فرق آخر قياس ${sign(last.waistDelta, "سم")}` : "سم عند السرّة"}
        </p>
        <Line values={measures.map((row) => row.waist)} label="خط الخصر" />
      </Card>

      <Card className="p-4">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">الوزن</h2>
          <p className="text-xl font-semibold tabular-nums">{last ? `${last.weight}` : "—"}</p>
        </div>
        <Line values={measures.map((row) => row.weight)} label="خط الوزن" />
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">آخر وزن على الجهاز</h2>
        {lifts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">يسجَّل مع التمرين، بالكيلو كما يظهر على الجهاز.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {lifts.map((lift) => {
              const delta = lift.last !== null && lift.prev !== null ? lift.last - lift.prev : null;
              return (
                <li key={lift.name} className="flex items-center justify-between gap-3 text-sm">
                  <span>{lift.name}</span>
                  <span className="tabular-nums text-muted">
                    {lift.last} كغ{delta === null ? "" : ` · ${sign(delta, "")}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">صور الجسم</h2>
        {model.shots.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" dir="ltr">
            {model.shots.map((shot) => (
              <figure key={shot.date} className="m-0 shrink-0">
                <img src={shot.image} alt="" className="h-28 w-20 rounded-xl object-cover" />
                <figcaption className="mt-1 text-center text-[10px] text-muted" dir="ltr">
                  {shot.date.slice(5)}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">صورة كل جمعة من صفحة القياس. تظهر هنا وفي ملف PDF من الأقدم إلى الأحدث.</p>
        )}
      </Card>

      <Btn
        className="w-full"
        disabled={busy}
        onClick={async () => {
          const node = sheetRef.current;
          if (!node) return;
          setBusy(true);
          setFailed(false);
          try {
            await exportReportPdf(node, `jeet-${iso(today)}.pdf`);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileDown className="size-4" aria-hidden />
        {busy ? "يجهّز الملف" : "تصدير PDF"}
      </Btn>
      {failed ? <p className="text-sm text-flame">تعذّر إنشاء الملف. حاول مرة أخرى.</p> : null}
      <p className="text-sm text-muted">
        الملف يفصّل الأيام والتمارين والأوزان والقياسات، وفيه قيود تمنع تغيير الخطة. أرسله كما هو للنموذج.
      </p>
      {busy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg text-fg">
          <p className="text-lg">يجهّز الملف</p>
        </div>
      ) : null}

      <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 794 }}>
        <div ref={sheetRef}>
          <ReportSheet model={model} />
        </div>
      </div>
    </div>
  );
}
