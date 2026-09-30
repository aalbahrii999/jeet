type AndroidBridge = {
  exit?: () => void;
  requestNotify?: () => void;
  openNotifySettings?: () => void;
  notifyStatus?: () => string;
  syncReminder?: (payload: string) => void;
  sharePdf?: (base64: string, filename: string) => string;
};

type JeetWindow = Window & {
  JeetAndroid?: AndroidBridge;
  jeetBack?: () => string;
  jeetSyncReminders?: () => void;
};

export function jeetWindow(): JeetWindow {
  return window as JeetWindow;
}

export function androidBridge(): AndroidBridge | null {
  return jeetWindow().JeetAndroid ?? null;
}
