type AndroidBridge = {
  exit?: () => void;
  requestNotify?: () => void;
  openNotifySettings?: () => void;
  notifyStatus?: () => string;
  syncReminder?: (payload: string) => void;
  sharePdf?: (base64: string, filename: string) => string;
  takePhoto?: (facing: string) => void;
  pickImage?: () => void;
};

type JeetWindow = Window & {
  JeetAndroid?: AndroidBridge;
  jeetBack?: () => string;
  jeetSyncReminders?: () => void;
  jeetOnPhoto?: (data: string | null) => void;
};

export function jeetWindow(): JeetWindow {
  return window as JeetWindow;
}

export function androidBridge(): AndroidBridge | null {
  return jeetWindow().JeetAndroid ?? null;
}

function waitPhoto(start: () => void): Promise<string | null> {
  const win = jeetWindow();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      if (win.jeetOnPhoto === finish) delete win.jeetOnPhoto;
      resolve(null);
    }, 120000);
    const finish = (data: string | null) => {
      window.clearTimeout(timer);
      delete win.jeetOnPhoto;
      resolve(data);
    };
    win.jeetOnPhoto = finish;
    start();
  });
}

function asImage(data: string): string {
  return data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`;
}

export async function takeDevicePhoto(facing: "user" | "environment"): Promise<"file" | "cancel" | "denied" | string> {
  const bridge = androidBridge();
  if (!bridge?.takePhoto) return "file";
  const data = await waitPhoto(() => bridge.takePhoto?.(facing));
  if (data === "denied") return "denied";
  if (!data) return "cancel";
  return asImage(data);
}

export async function pickDevicePhoto(): Promise<"file" | "cancel" | string> {
  const bridge = androidBridge();
  if (!bridge?.pickImage) return "file";
  const data = await waitPhoto(() => bridge.pickImage?.());
  if (!data || data === "denied") return "cancel";
  return asImage(data);
}
