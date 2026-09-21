#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importRecipe } from "../worker/hello-fresh-importer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const bundlePath = path.join(dataDir, "menu-weeks.json");
const temporaryBundlePath = `${bundlePath}.tmp`;
const indexPath = path.join(dataDir, "recipe-details-index.json");
const temporaryIndexPath = `${indexPath}.tmp`;
const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
let existingIndex = null;
try {
  existingIndex = JSON.parse(await readFile(indexPath, "utf8"));
} catch {
  // The index is created after the first successful import.
}
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
if (failures.length) {
  throw new Error(`Rezeptdetails konnten nicht vollständig aktualisiert werden: ${failures.map(({ id }) => id).join(", ")}`);
}

for (const menu of Object.values(bundle.menus)) {
  menu.availableWeeks = bundle.availableWeeks;
  for (const recipe of menu.recipes) {
    const detail = JSON.parse(await readFile(path.join(outputDir, `${recipe.id}.json`), "utf8"));
    if (!detail.ingredients?.length || !detail.steps?.length) {
      throw new Error(`Rezeptdetail ${recipe.id} ist unvollständig.`);
    }
    if (detail.time && detail.time !== "nicht angegeben") recipe.time = detail.time;
  }
}

await writeFile(temporaryBundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
const nextIndex = {
  generatedAt: new Date().toISOString(),
  expected: recipes.length,
  saved: completed,
  failures,
  availableWeeks: bundle.availableWeeks.map((week) => week.value),
};
const indexDataChanged = !existingIndex || JSON.stringify({ ...existingIndex, generatedAt: undefined }) !== JSON.stringify({ ...nextIndex, generatedAt: undefined });
await writeFile(temporaryIndexPath, `${JSON.stringify(indexDataChanged ? nextIndex : existingIndex, null, 2)}\n`, "utf8");
await rename(temporaryBundlePath, bundlePath);
await rename(temporaryIndexPath, indexPath);

console.log(`Validated ${completed} of ${recipes.length} recipe details; existing details outside the visible week window were retained.`);
