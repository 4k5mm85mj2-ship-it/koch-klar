import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";
import { extractRecipeUrls, parseRecipePage } from "../worker/hello-fresh-importer.js";

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
        if (String(url).includes("/essensbox/menu")) {
          return new Response(Array.from({ length: 4 }, (_, index) =>
            `<a href="${recipeUrl.replace("testgericht", `testgericht-${index}`)}">Rezept</a>`).join(""));
        }
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
  assert.deepEqual(calls, ["/data/menu.json"]);
  const menu = await response.json();
  assert.equal(menu.dataStatus, "live");
  assert.equal(menu.recipes.length, 4);
  assert.equal(menu.recipes[0].time, "25 Minuten");
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

test("keeps the bundled menu usable when the public source is unavailable", async () => {
  const snapshot = { importedAt: "20. September 2026", recipes: [{ id: "stored" }] };
  const response = await worker.fetch(new Request("https://example.test/api/menu"), {
    HELLOFRESH_FETCH: async () => { throw new Error("offline"); },
    ASSETS: { fetch: async () => Response.json(snapshot) },
  });
  const menu = await response.json();
  assert.equal(menu.dataStatus, "fallback");
  assert.deepEqual(menu.recipes, snapshot.recipes);
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
});
