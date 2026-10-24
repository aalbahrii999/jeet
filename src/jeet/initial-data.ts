// Replaced only when building the explicitly selected personal APK.
declare const __JEET_INITIAL_BACKUP__: string | undefined;

export function initialBackup(): string | null {
  return typeof __JEET_INITIAL_BACKUP__ === "string" && __JEET_INITIAL_BACKUP__
    ? __JEET_INITIAL_BACKUP__ : null;
}
