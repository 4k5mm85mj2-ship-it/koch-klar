import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addIsoWeeks,
  helloFreshWeekForDate,
  parseMenuPage,
  spokenWeekLabel,
  weekValuesAround,
} from "../worker/hello-fresh-importer.js";

const menuHtml = `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { ssrPayload: {
    activeWeek: "2026-W40",
    courses: Array.from({ length: 7 }, (_, index) => ({
      index,
      recipe: {
        id: `recipe-${index}`,
        name: `Gericht ${index + 1}`,
        imageLink: `https://media.hellofresh.com/${index}.jpg`,
        totalTime: "PT35M",
        websiteUrl: `https://www.hellofresh.de/recipes/testgericht-${index}-1234567890abcdef1234`,
        tags: [],
      },
    })),
  } } },
})}</script>`;

test("uses natural option text for two past, current, and three future weeks", () => {
  const menu = parseMenuPage(menuHtml, new Date("2026-09-20T10:00:00Z"));
  assert.deepEqual(menu.availableWeeks.map(({ value }) => value), [
    "2026-W38", "2026-W39", "2026-W40", "2026-W41", "2026-W42", "2026-W43",
  ]);
  assert.deepEqual(menu.availableWeeks.map(({ label }) => label), [
    "12. September 2026 bis 18. September 2026",
    "19. September 2026 bis 25. September 2026",
    "26. September 2026 bis 2. Oktober 2026",
    "3. Oktober 2026 bis 9. Oktober 2026",
    "10. Oktober 2026 bis 16. Oktober 2026",
    "17. Oktober 2026 bis 23. Oktober 2026",
  ]);
  assert.ok(menu.availableWeeks.every(({ label }) => !label.includes("Aktuelles Menü")));
  assert.equal(spokenWeekLabel("2026-W40"), "26. September 2026 bis 2. Oktober 2026");
  assert.equal(addIsoWeeks("2026-W01", -2), "2025-W51");
  assert.equal(weekValuesAround("2026-W01", { past: 2, future: 3 }).length, 6);
});

test("derives the current HelloFresh delivery week from the Berlin calendar date", () => {
  assert.equal(helloFreshWeekForDate(new Date("2026-10-23T21:59:59Z")), "2026-W43");
  assert.equal(helloFreshWeekForDate(new Date("2026-10-23T22:00:00Z")), "2026-W44");
  assert.equal(helloFreshWeekForDate(new Date("2027-01-01T22:59:59Z")), "2026-W53");
  assert.equal(helloFreshWeekForDate(new Date("2027-01-01T23:00:00Z")), "2027-W01");
  assert.equal(addIsoWeeks("2026-W53", 1), "2027-W01");
  assert.deepEqual(weekValuesAround("2027-W01"), [
    "2026-W52", "2026-W53", "2027-W01", "2027-W02", "2027-W03", "2027-W04",
  ]);
});

test("anchors the rolling snapshot window to the delivery week instead of the orderable menu", async () => {
  const refreshSource = await readFile(new URL("../scripts/refresh-menu-snapshots.mjs", import.meta.url), "utf8");
  assert.match(refreshSource, /const currentWeek = helloFreshWeekForDate\(now\)/);
  assert.match(refreshSource, /weekValuesAround\(currentWeek\)/);
  assert.match(refreshSource, /weekValuesAround\(currentWeek, \{ past: 2, future: 16 \}\)/);
  assert.match(refreshSource, /defaultWeek: currentWeek/);
  assert.doesNotMatch(refreshSource, /weekValuesAround\(sourceCurrent\.week/);
});

test("keeps the weekly selector native without ARIA overrides on its options", async () => {
  const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const selectStart = appSource.indexOf('<select id="week-select"');
  const weekSelect = appSource.slice(selectStart, appSource.indexOf("</select>", selectStart));
  assert.match(weekSelect, /availableWeeks\.map\(\(week\) => <option key=\{week\.value\} value=\{week\.value\}>\{week\.label\}<\/option>\)/);
  assert.doesNotMatch(weekSelect, /aria-(?:label|labelledby|describedby)/);
  assert.doesNotMatch(appSource, /Aktuelles Menü/);
  assert.doesNotMatch(appSource, /setAnnouncement\(`\$\{(?:bundledMenu|importedMenu)\.weekLabel\}/);
});
