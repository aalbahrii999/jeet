import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "android/app/src/main/assets/www");
const initialBackup = process.env.JEET_INITIAL_BACKUP_FILE
  ? JSON.stringify(JSON.parse(await readFile(process.env.JEET_INITIAL_BACKUP_FILE, "utf8"))) : "";

// The APK uses a standalone file:// bundle, not TanStack Start's server output.
// Regenerate it before Gradle packages assets so source changes reach the APK.
await build({
  configFile: false,
  root,
  base: "./",
  publicDir: false,
  plugins: [react(), tailwindcss()],
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "__JEET_INITIAL_BACKUP__": JSON.stringify(initialBackup) },
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: false,
    lib: { entry: join(root, "src/apk.tsx"), name: "Jeet", formats: ["iife"], fileName: () => "app.js", cssFileName: "app" },
  },
});
await mkdir(outDir, { recursive: true });
await cp(join(root, "public/machines"), join(outDir, "machines"), { recursive: true });
await writeFile(join(outDir, "index.html"), `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101412"><title>جيت</title>
<link rel="stylesheet" href="./app.css"><script defer src="./app.js"></script>
</head><body><div id="root"></div></body></html>\n`);
console.log("Updated Android web assets.");
