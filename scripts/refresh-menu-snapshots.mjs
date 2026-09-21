#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importCurrentMenu,
  weekOption,
  weekValuesAround,
} from "../worker/hello-fresh-importer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "src", "data", "menu-weeks.json");
const temporaryOutput = `${output}.tmp`;
const volatileKeys = new Set(["generatedAt", "checkedAt", "importedAt"]);

function withoutVolatileMetadata(value) {
  if (Array.isArray(value)) return value.map(withoutVolatileMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !volatileKeys.has(key))
    .map(([key, child]) => [key, withoutVolatileMetadata(child)]));
}

async function readExistingBundle() {
  try {
    return JSON.parse(await readFile(output, "utf8"));
  } catch {
    return { menus: {} };
  }
}

async function importWeeks(values, current) {
  const results = new Map([[current.week, current]]);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const requestedWeek = values[cursor++];
      if (results.has(requestedWeek)) continue;
      try {
        const menu = await importCurrentMenu({ week: requestedWeek });
        if (menu.week === requestedWeek) results.set(requestedWeek, menu);
      } catch {
        // Missing optional weeks are ignored and required weeks are validated below.
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return results;
}

const existing = await readExistingBundle();
const current = await importCurrentMenu({});
const requiredValues = weekValuesAround(current.week);
const candidateValues = weekValuesAround(current.week, { past: 2, future: 16 });
const imported = await importWeeks(candidateValues, current);

for (const value of requiredValues) {
  if (!imported.has(value) && existing.menus?.[value]) imported.set(value, existing.menus[value]);
}

const missingRequired = requiredValues.filter((value) => !imported.has(value));
if (missingRequired.length) {
  throw new Error(`Pflichtwochen konnten nicht vollständig geladen werden: ${missingRequired.join(", ")}`);
}

const visibleValues = candidateValues.filter((value) => imported.has(value));
const availableWeeks = visibleValues.map(weekOption);
const menus = Object.fromEntries(visibleValues.map((value) => {
  const menu = imported.get(value);
  if (!Array.isArray(menu.recipes) || menu.recipes.length <= 4) {
    throw new Error(`Woche ${value} enthält kein vollständiges Menü.`);
  }
  return [value, { ...menu, availableWeeks }];
}));

const bundle = {
  defaultWeek: current.week,
  availableWeeks,
  generatedAt: new Date().toISOString(),
  menus,
};

await mkdir(path.dirname(output), { recursive: true });
const changed = JSON.stringify(withoutVolatileMetadata(bundle)) !== JSON.stringify(withoutVolatileMetadata(existing));
if (changed) {
  await writeFile(temporaryOutput, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await rename(temporaryOutput, output);
  console.log(`Saved ${visibleValues.length} weeks with ${Object.values(menus).reduce((sum, menu) => sum + menu.recipes.length, 0)} recipes.`);
} else {
  console.log("No weekly menu changes detected.");
}
