import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
let next = 0;
const url = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
export async function loadJeet() {
  const id = ++next, cache = new Map();
  const react = url("export function useEffect(){};export function useSyncExternalStore(subscribe,read){return read()}");
  async function compile(file) {
    if (cache.has(file.href)) return cache.get(file.href);
    let code = stripTypeScriptTypes(await readFile(file, "utf8"));
    for (const match of [...code.matchAll(/from\s+["']([^"']+)["']/g)]) {
      const specifier = match[1];
      const target = specifier === "react" ? react : specifier.startsWith(".") ? await compile(new URL(specifier + ".ts", file)) : null;
      if (target) code = code.replace(match[0], `from "${target}"`);
    }
    const result = url(code + `\n// isolated test instance ${id}`); cache.set(file.href, result); return result;
  }
  const modules = {};
  for (const name of ["types", "plan", "logic", "schema", "program", "store"]) modules[name] = await import(await compile(new URL(`../src/jeet/${name}.ts`, import.meta.url)));
  return modules;
}
