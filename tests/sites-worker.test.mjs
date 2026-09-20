import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";
import { extractRecipeUrls, parseMenuPage, parseRecipePage } from "../worker/hello-fresh-importer.js";
import { LONG_STEP_THRESHOLD, segmentCookStep } from "../src/cook-step-segments.js";
import { filterRecipes, timeFilterFor, totalMinutes } from "../src/recipe-filters.js";

const recipeUrl = "https://www.hellofresh.de/recipes/testgericht-mit-gemuse-1234567890abcdef1234";
const recipeHtml = `<!doctype html><script type="application/ld+json">${JSON.stringify({
  "@type": "Recipe",
  name: "Testgericht mit Gemüse",
  description: "Ein <strong>einfaches</strong> Testgericht.",
  image: "https://media.hellofresh.com/test.jpg",
  totalTime: "PT25M",
  recipeYield: 2,
  recipeIngredient: ["400 g Kartoffeln", "1 Stück Zwiebel"],
  recipeInstructions: [{ "@type": "HowToStep", text: "<p>Kartoffeln schneiden.</p>" }],
})}</script>`;
const menuHtml = `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { ssrPayload: {
    activeWeek: "2026-W40",
    courses: Array.from({ length: 7 }, (_, index) => ({
      index,
      recipe: {
        id: `recipe-${index}`,
        name: index < 3 ? `Vegetarisches Gericht ${index + 1}` : `Gericht ${index + 1}`,
        headline: "Ein Testgericht",
        imageLink: `https://media.hellofresh.com/${index}.jpg`,
        prepTime: "PT25M",
        totalTime: "PT35M",
        difficulty: 1,
        websiteUrl: recipeUrl.replace("testgericht", `testgericht-${index}`),
        tags: index < 3 ? [{ name: "Vegetarisch", type: "veggie" }] : [],
      },
    })),
  } } },
})}</script>`;

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("serves the imported menu snapshot through the internal API", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/api/menu", { headers: { accept: "application/json" } }),
    {
      HELLOFRESH_FETCH: async (url) => {
        if (String(url).includes("/menus")) return new Response(menuHtml);
        return new Response(recipeHtml);
      },
      ASSETS: {
        fetch: async (request) => {
          calls.push(new URL(request.url).pathname);
          return new Response(JSON.stringify({ importedAt: "20. September 2026", recipes: [{ id: "real-recipe" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(calls, ["/data/menu.json", "/data/menu-weeks.json"]);
  const menu = await response.json();
  assert.equal(menu.dataStatus, "live");
  assert.equal(menu.week, "2026-W40");
  assert.equal(menu.availableWeeks.length, 6);
  assert.equal(menu.recipes.length, 7);
  assert.equal(menu.recipes[0].time, "35 Minuten");
  assert.equal(menu.recipes[0].dietGroup, "vegetarian");
});

test("parses every unique available course from a weekly menu", () => {
  const menu = parseMenuPage(menuHtml, new Date("2026-09-20T10:00:00Z"));
  assert.equal(menu.weekLabel, "26. September–2. Oktober 2026");
  assert.equal(menu.totalRecipes, 7);
  assert.equal(menu.recipes[0].time, "35 Minuten");
  assert.equal(menu.recipes.filter((recipe) => recipe.dietGroup === "vegetarian").length, 3);
});

test("extracts unique recipe detail URLs and ignores category pages", () => {
  const html = `<a href="/recipes/vegetarische-rezepte">Kategorie</a>
    <a href="/recipes/ein-rezept-1234567890abcdef1234?x=1">Eins</a>
    <a href="https:\\/\\/www.hellofresh.de\\/recipes\\/zwei-rezept-abcdef1234567890abcd">Zwei</a>`;
  assert.deepEqual(extractRecipeUrls(html), [
    "https://www.hellofresh.de/recipes/ein-rezept-1234567890abcdef1234",
    "https://www.hellofresh.de/recipes/zwei-rezept-abcdef1234567890abcd",
  ]);
});

test("turns structured HelloFresh recipe data into the accessible menu shape", () => {
  const recipe = parseRecipePage(recipeHtml, recipeUrl, { recipes: [] });
  assert.equal(recipe.title, "Testgericht mit Gemüse");
  assert.equal(recipe.time, "25 Minuten");
  assert.equal(recipe.servings, "2 Portionen");
  assert.equal(recipe.ingredients[0].amount, "400 g");
  assert.equal(recipe.steps[0], "Kartoffeln schneiden.");
  assert.equal(recipe.ingredients[0].packaging, undefined);
});

test("adds packaging only when a concrete curated description exists", () => {
  const recipe = parseRecipePage(recipeHtml, recipeUrl, {
    recipes: [{ ingredients: [{ name: "Kartoffeln", packaging: "Kleines Netz mit festen Knollen." }] }],
  });
  assert.equal(recipe.ingredients[0].packaging, "Kleines Netz mit festen Knollen.");
  assert.equal(recipe.ingredients[1].packaging, undefined);
});

test("loads complete recipe details only when a recipe is opened", async () => {
  const response = await worker.fetch(new Request(`https://example.test/api/recipe?url=${encodeURIComponent(recipeUrl)}`), {
    HELLOFRESH_FETCH: async () => new Response(recipeHtml),
    ASSETS: { fetch: async () => Response.json({ recipes: [] }) },
  });
  const recipe = await response.json();
  assert.equal(response.status, 200);
  assert.equal(recipe.steps[0], "Kartoffeln schneiden.");
  assert.equal(recipe.ingredients[0].amount, "400 g");
});

test("serves bundled recipe details without a live HelloFresh request", async () => {
  let liveCalls = 0;
  const storedDetail = { id: "stored", ingredients: [{ name: "Kartoffeln", amount: "400 g" }], steps: ["Schneiden."] };
  const response = await worker.fetch(new Request(`https://example.test/api/recipe?url=${encodeURIComponent(recipeUrl)}`), {
    HELLOFRESH_FETCH: async () => { liveCalls += 1; return new Response(recipeHtml); },
    ASSETS: {
      fetch: async (request) => new URL(request.url).pathname.startsWith("/data/recipes/")
        ? Response.json(storedDetail)
        : Response.json({ recipes: [] }),
    },
  });
  const recipe = await response.json();
  assert.equal(response.status, 200);
  assert.equal(recipe.steps[0], "Schneiden.");
  assert.equal(liveCalls, 0);
});

test("rejects arbitrary recipe sources", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/recipe?url=https%3A%2F%2Fexample.org%2Frecipe"), {
    ASSETS: { fetch: async () => Response.json({ recipes: [] }) },
  });
  assert.equal(response.status, 400);
});

test("keeps the bundled menu usable when the public source is unavailable", async () => {
  const snapshot = { weekLabel: "21.–27. September 2026", importedAt: "20. September 2026", recipes: [{ id: "stored" }] };
  const response = await worker.fetch(new Request("https://example.test/api/menu"), {
    HELLOFRESH_FETCH: async () => { throw new Error("offline"); },
    ASSETS: { fetch: async () => Response.json(snapshot) },
  });
  const menu = await response.json();
  assert.equal(menu.dataStatus, "fallback");
  assert.deepEqual(menu.recipes, snapshot.recipes);
});

test("serves a complete bundled week immediately when the public source is unavailable", async () => {
  const storedWeek = {
    week: "2026-W40",
    weekLabel: "26. September–2. Oktober 2026",
    importedAt: "20. September 2026",
    sourceName: "HelloFresh Deutschland",
    recipes: Array.from({ length: 100 }, (_, index) => ({ id: `stored-${index}` })),
  };
  const bundle = {
    defaultWeek: "2026-W40",
    availableWeeks: [{ value: "2026-W40", label: storedWeek.weekLabel }],
    menus: { "2026-W40": storedWeek },
  };
  const response = await worker.fetch(new Request("https://example.test/api/menu?week=2026-W40"), {
    HELLOFRESH_FETCH: async () => { throw new Error("offline"); },
    ASSETS: {
      fetch: async (request) => Response.json(new URL(request.url).pathname.endsWith("menu-weeks.json") ? bundle : { recipes: [] }),
    },
  }, { waitUntil() {} });
  const menu = await response.json();
  assert.equal(response.status, 200);
  assert.equal(menu.dataStatus, "snapshot");
  assert.equal(menu.recipes.length, 100);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/server/hello-fresh-importer.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/client/data/menu.json", import.meta.url));
  await access(new URL("../dist/client/data/menu-weeks.json", import.meta.url));
  await access(new URL("../dist/client/data/recipe-details-index.json", import.meta.url));
});

test("every displayed weekly recipe has a working image URL and bundled details", async () => {
  const bundle = JSON.parse(await readFile(new URL("../src/data/menu-weeks.json", import.meta.url), "utf8"));
  const recipes = Object.values(bundle.menus).flatMap((menu) => menu.recipes);
  assert.ok(bundle.availableWeeks.length > 1);
  assert.ok(Object.values(bundle.menus).every((menu) => menu.recipes.length > 4));
  assert.equal(recipes.length, new Set(recipes.map((recipe) => recipe.id)).size);
  for (const recipe of recipes) {
    assert.match(recipe.image, /^https:\/\/media\.hellofresh\.com\//);
    const detail = JSON.parse(await readFile(new URL(`../src/data/recipes/${recipe.id}.json`, import.meta.url), "utf8"));
    assert.ok(detail.ingredients.length > 0, `${recipe.title} has no ingredients`);
    assert.ok(detail.steps.length > 0, `${recipe.title} has no steps`);
    assert.equal(recipe.time, detail.time, `${recipe.title} does not use the recipe total time`);
    assert.ok(timeFilterFor(recipe.time), `${recipe.title} has no total-time filter group`);
  }
});

test("segments every bundled cooking step without changing its text", async () => {
  const bundle = JSON.parse(await readFile(new URL("../src/data/menu-weeks.json", import.meta.url), "utf8"));
  const recipes = Object.values(bundle.menus).flatMap((menu) => menu.recipes);
  const steps = [];
  for (const recipe of recipes) {
    const detail = JSON.parse(await readFile(new URL(`../src/data/recipes/${recipe.id}.json`, import.meta.url), "utf8"));
    steps.push(...detail.steps);
  }

  assert.ok(steps.length >= 100);
  let segmentedLongSteps = 0;
  for (const step of steps) {
    const segments = segmentCookStep(step);
    assert.equal(segments.join(""), step);
    if (step.length <= LONG_STEP_THRESHOLD && !/[\r\n]/.test(step)) assert.equal(segments.length, 1);
    if (segments.length > 1) {
      segmentedLongSteps += 1;
      for (const segment of segments.slice(0, -1)) assert.match(segment.trimEnd(), /[.!?…]["'”’)]*$/);
    }
  }
  assert.ok(segmentedLongSteps > 100);
});

test("prefers source paragraphs and safely keeps an indivisible long instruction", () => {
  const paragraphs = "Erster kurzer Absatz.\nZweiter kurzer Absatz.";
  assert.deepEqual(segmentCookStep(paragraphs), ["Erster kurzer Absatz.\n", "Zweiter kurzer Absatz."]);

  const unusual = "Eine ungewöhnliche Anweisung ".repeat(14).trim();
  assert.ok(unusual.length > LONG_STEP_THRESHOLD);
  assert.deepEqual(segmentCookStep(unusual), [unusual]);
});

test("does not treat a continuing abbreviation as a sentence boundary", () => {
  const instruction = "Wasser aufkochen und den Reis ca. 12 Min. abgedeckt garen. Anschließend abgießen und servieren.";
  const longInstruction = `${instruction} ${instruction} ${instruction}`;
  const segments = segmentCookStep(longInstruction);
  assert.equal(segments.join(""), longInstruction);
  assert.ok(segments.every((segment) => !/ca\.\s*$/.test(segment)));
});

test("maps every time boundary to exactly one total-time filter", () => {
  assert.equal(totalMinutes("110 Minuten"), 110);
  assert.deepEqual([20, 21, 30, 31, 45, 46, 60, 61].map((minutes) => timeFilterFor(`${minutes} Minuten`)), [
    "up-to-20", "21-to-30", "21-to-30", "31-to-45", "31-to-45", "46-to-60", "46-to-60", "over-60",
  ]);
});

test("combines dietary, difficulty, and total-time filters as an intersection", () => {
  const recipes = [
    { id: "match", dietGroup: "vegetarian", difficulty: "einfach", time: "25 Minuten" },
    { id: "wrong-diet", dietGroup: "non-vegetarian", difficulty: "einfach", time: "25 Minuten" },
    { id: "wrong-difficulty", dietGroup: "vegetarian", difficulty: "mittel", time: "25 Minuten" },
    { id: "wrong-time", dietGroup: "vegetarian", difficulty: "einfach", time: "40 Minuten" },
  ];
  assert.deepEqual(filterRecipes(recipes, { diet: "vegetarian", difficulty: "einfach", totalTime: "21-to-30" }).map(({ id }) => id), ["match"]);
  assert.equal(filterRecipes(recipes).length, recipes.length);
});

test("keeps only the requested reduced interface guidance", async () => {
  const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /Wähle ein Gericht\. Danach erhältst du Zutaten/);
  assert.doesNotMatch(appSource, /Der vollständige Schritt ist fokussiert/);
  assert.doesNotMatch(appSource, /Funktionaler Prototyp ohne Anmeldung/);
  assert.ok(appSource.indexOf("Nächster Schritt") < appSource.indexOf("Vorheriger Schritt"));
});

test("groups the step label with the first segment for assistive technology", async () => {
  const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /const currentStepAccessibleText = selectedRecipe \? `\$\{currentStepLabel\}\. \$\{currentStepSegments\[0\]\}` : ""/);
  assert.match(appSource, /<h1 id="cook-heading" className="sr-only"[^>]+>\{currentStepAccessibleText\}<\/h1>/);
  assert.match(appSource, /<div className="cook-step-heading" aria-hidden="true">\{currentStepLabel\}<\/div>/);
  assert.doesNotMatch(appSource, /id="cook-heading"[^>]+aria-label=/);
  assert.match(appSource, /aria-hidden=\{index === 0 \? "true" : undefined\}/);
  assert.match(appSource, /className="step-progress"[^>]+aria-hidden="true"/);
});

test("keeps filter focus and provides contextual back navigation", async () => {
  const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /pendingFocus\.control\.blur\(\)/);
  assert.match(appSource, /control\.focus\(\{ preventScroll: true \}\)/);
  assert.match(appSource, /requestAnimationFrame\(\(\) =>/);
  assert.match(appSource, /pendingFocus\.waitForMenu && menuLoading/);
  assert.match(appSource, /pendingFilterFocusRef\.current = null/);
  assert.match(appSource, /aria-disabled=\{!filtersActive\}/);
  assert.match(appSource, /event\.key !== "Escape"/);
  assert.match(appSource, /if \(view === "cook"\) navigate\("recipe"\)/);
  assert.match(appSource, /else if \(view === "recipe"\) navigate\("menu"\)/);
});

test("uses the requested actions and DOM order on the last cooking step", async () => {
  const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const lastStepActions = appSource.slice(appSource.indexOf("stepIndex < selectedRecipe.steps.length - 1"));
  const recipeBack = lastStepActions.indexOf(">Zurück zu den Rezeptdetails</button>");
  const previous = lastStepActions.indexOf(">Vorheriger Schritt</button>");
  const menuBack = lastStepActions.indexOf(">Zurück zum Wochenmenü</button>");
  assert.ok(recipeBack >= 0 && recipeBack < previous && previous < menuBack);
  assert.doesNotMatch(appSource, /Fertig – zurück zum Wochenmenü/);
});
