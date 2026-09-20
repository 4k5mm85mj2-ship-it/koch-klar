#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importCurrentMenu } from "../worker/hello-fresh-importer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "src", "data", "menu-weeks.json");

const current = await importCurrentMenu({});
const weekValues = current.availableWeeks.map((week) => week.value);
const results = await Promise.allSettled(weekValues.map((week) => (
  week === current.week ? Promise.resolve(current) : importCurrentMenu({ week })
)));
const imported = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
const availableWeeks = current.availableWeeks.filter((week) => imported.some((menu) => menu.week === week.value));
for (const menu of imported) menu.availableWeeks = availableWeeks;
const menus = Object.fromEntries(imported.map((menu) => [menu.week, menu]));

const bundle = {
  defaultWeek: current.week,
  availableWeeks,
  generatedAt: new Date().toISOString(),
  menus,
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
console.log(`Saved ${imported.length} weeks with ${imported.reduce((sum, menu) => sum + menu.recipes.length, 0)} recipes.`);
