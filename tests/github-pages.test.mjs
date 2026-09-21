import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist", "client");

test("emits a GitHub Pages entry point with relative assets", async () => {
  const html = await readFile(path.join(clientDir, "index.html"), "utf8");
  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="\/src\//);
});

test("does not ship the unavailable internal menu API in the Pages bundle", async () => {
  const assets = await readdir(path.join(clientDir, "assets"));
  const scripts = assets.filter((name) => name.endsWith(".js"));
  assert.ok(scripts.length > 0);
  const source = (await Promise.all(scripts.map((name) => readFile(path.join(clientDir, "assets", name), "utf8")))).join("\n");
  assert.doesNotMatch(source, /\/api\/menu/);
});

test("has local details for every recipe shown in every bundled week", async () => {
  const weeks = JSON.parse(await readFile(path.join(root, "src", "data", "menu-weeks.json"), "utf8"));
  const recipes = Object.values(weeks.menus).flatMap((menu) => menu.recipes);
  assert.ok(recipes.length > 0);
  assert.equal(new Set(recipes.map(({ id }) => id)).size, recipes.length);
  for (const { id } of recipes) {
    await access(path.join(root, "src", "data", "recipes", `${id}.json`));
  }
});

test("uses KochKlar branding and a non-interactive independence notice", async () => {
  const appSource = await readFile(path.join(root, "src", "App.jsx"), "utf8");
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const footer = appSource.slice(appSource.indexOf('<footer className="site-footer">'), appSource.indexOf("</footer>"));

  assert.match(appSource, /<span className="wordmark">KochKlar<\/span>/);
  assert.match(html, /<title>KochKlar – barrierearm kochen mit Rezepten von HelloFresh<\/title>/);
  assert.match(readme, /^# KochKlar/m);
  assert.match(footer, /unabhängiger, nicht kommerzieller Prototyp/);
  assert.match(footer, /steht in keiner Verbindung zu HelloFresh/);
  assert.doesNotMatch(footer, /<(?:a|button|input|select|textarea)\b|tabIndex=/);
  assert.doesNotMatch(appSource, /Einfach kochen/);
});
