#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importRecipe } from "../worker/hello-fresh-importer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const bundlePath = path.join(dataDir, "menu-weeks.json");
const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const fallbackMenu = JSON.parse(await readFile(path.join(dataDir, "menu-snapshot.json"), "utf8"));
const outputDir = path.join(dataDir, "recipes");
const recipes = [...new Map(Object.values(bundle.menus).flatMap((menu) => menu.recipes).map((recipe) => [recipe.id, recipe])).values()];
const forceRefresh = process.argv.includes("--force");
const failures = [];
let completed = 0;
let cursor = 0;

await mkdir(outputDir, { recursive: true });

async function worker() {
  while (cursor < recipes.length) {
    const recipe = recipes[cursor++];
    const outputFile = path.join(outputDir, `${recipe.id}.json`);
    if (!forceRefresh) {
      try {
        await readFile(outputFile, "utf8");
        completed += 1;
        continue;
      } catch {
        // Missing detail snapshots are fetched below.
      }
    }
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const detail = await importRecipe({ sourceUrl: recipe.sourceUrl, fallbackMenu });
        await writeFile(outputFile, `${JSON.stringify({ ...recipe, ...detail, id: recipe.id }, null, 2)}\n`, "utf8");
        completed += 1;
        if (completed % 25 === 0) console.log(`Saved ${completed} of ${recipes.length} recipe details.`);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (/Status 404/.test(error.message)) break;
      }
    }
    if (lastError) failures.push({ id: recipe.id, title: recipe.title, message: lastError.message });
  }
}

await Promise.all(Array.from({ length: 10 }, () => worker()));
const failedIds = new Set(failures.map((failure) => failure.id));
const usableMenus = Object.fromEntries(Object.entries(bundle.menus).filter(([, menu]) => menu.recipes.every((recipe) => !failedIds.has(recipe.id))));
const availableWeeks = bundle.availableWeeks.filter((week) => usableMenus[week.value]);
for (const menu of Object.values(usableMenus)) {
  menu.availableWeeks = availableWeeks;
  for (const recipe of menu.recipes) {
    const detail = JSON.parse(await readFile(path.join(outputDir, `${recipe.id}.json`), "utf8"));
    if (detail.time && detail.time !== "nicht angegeben") recipe.time = detail.time;
  }
}
const usableBundle = {
  ...bundle,
  defaultWeek: usableMenus[bundle.defaultWeek] ? bundle.defaultWeek : availableWeeks[0]?.value,
  availableWeeks,
  menus: usableMenus,
};
await writeFile(bundlePath, `${JSON.stringify(usableBundle, null, 2)}\n`, "utf8");
await writeFile(path.join(dataDir, "recipe-details-index.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  expected: recipes.length,
  saved: completed,
  failures,
  availableWeeks: availableWeeks.map((week) => week.value),
}, null, 2)}\n`, "utf8");

console.log(`Saved ${completed} of ${recipes.length} recipe details; ${failures.length} unpublished recipes were excluded with their unavailable week.`);
