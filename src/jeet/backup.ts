import { androidBridge, jeetWindow } from "./native";
type BackupReply = { kind: "saved" | "import" | "cancel" | "error"; content?: string };
function waitBackup(start: () => void): Promise<BackupReply> {
  return new Promise((resolve, reject) => {
    const win = jeetWindow();
    if (win.jeetOnBackup) { reject(new Error("أكمل عملية الملفات الحالية أولًا.")); return; }
    const cleanup = () => { window.clearTimeout(timeout); delete win.jeetOnBackup; };
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("انتهى انتظار اختيار الملف. حاول مرة أخرى.")); }, 300000);
    win.jeetOnBackup = (payload) => { cleanup(); try { const reply = JSON.parse(payload) as BackupReply; if (reply.kind === "error") reject(new Error("تعذّر فتح الملف أو حفظه.")); else resolve(reply); } catch { reject(new Error("تعذّر قراءة الملف.")); } };
    try { start(); } catch { cleanup(); reject(new Error("تعذّر فتح اختيار الملفات.")); }
  });
}
export async function exportData(content: string, filename: string): Promise<"saved" | "download" | "cancel"> {
  const bridge = androidBridge();
  if (bridge?.exportBackup) { const reply = await waitBackup(() => bridge.exportBackup!(content, filename)); return reply.kind === "saved" ? "saved" : "cancel"; }
  if (bridge) throw new Error("تصدير البيانات يحتاج تثبيت نسخة جيت المحدثة.");
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" })), link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "download";
}
export async function importDeviceBackup(): Promise<string | null | "browser"> {
  const bridge = androidBridge();
  if (!bridge) return "browser";
  if (!bridge.importBackup) throw new Error("استيراد البيانات يحتاج تثبيت نسخة جيت المحدثة.");
  const reply = await waitBackup(() => bridge.importBackup!());
  return reply.kind === "import" && typeof reply.content === "string" ? reply.content : null;
}
