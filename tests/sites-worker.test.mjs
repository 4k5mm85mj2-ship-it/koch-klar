import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";
import { extractRecipeUrls, parseMenuPage, parseRecipePage } from "../worker/hello-fresh-importer.js";

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
  assert.equal(menu.recipes[0].time, "25 Minuten");
  assert.equal(menu.recipes[0].dietGroup, "vegetarian");
});

test("parses every unique available course from a weekly menu", () => {
  const menu = parseMenuPage(menuHtml, new Date("2026-09-20T10:00:00Z"));
  assert.equal(menu.weekLabel, "26. September–2. Oktober 2026");
  assert.equal(menu.totalRecipes, 7);
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
  assert.match(recipe.ingredients[0].packaging, /Gemüsebeutel/);
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
});
