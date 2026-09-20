const REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "de-DE,de;q=0.9",
  "user-agent": "EinfachKochenAccessibilityPrototype/1.0",
};

const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtml(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
      if (entity[0] === "#") {
        const hexadecimal = entity[1]?.toLowerCase() === "x";
        const number = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : " ";
      }
      return HTML_ENTITIES[entity.toLowerCase()] ?? " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value = "") {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isRecipeType(type) {
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function collectJsonLd(value, recipes = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLd(item, recipes);
  } else if (value && typeof value === "object") {
    if (isRecipeType(value["@type"])) recipes.push(value);
    if (value["@graph"]) collectJsonLd(value["@graph"], recipes);
  }
  return recipes;
}

export function extractRecipeUrls(html) {
  const decoded = html.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const matches = decoded.match(/(?:https:\/\/www\.hellofresh\.de)?\/recipes\/[a-z0-9äöüß%+._~-]+-[0-9a-f]{20,}/gi) ?? [];
  const unique = [];

  for (const match of matches) {
    const absolute = new URL(match, "https://www.hellofresh.de");
    absolute.search = "";
    absolute.hash = "";
    if (!unique.includes(absolute.href)) unique.push(absolute.href);
  }

  return unique;
}

function isValidWeek(value) {
  return /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value ?? "");
}

function parseDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(value ?? "");
  if (!match) return "nicht angegeben";
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes ? `${minutes} Minuten` : "nicht angegeben";
}

function addIsoWeeks(isoWeek, amount) {
  const [yearText, weekText] = isoWeek.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + ((week - 1 + amount) * 7));
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstMonday = new Date(firstThursday);
  firstMonday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7));
  const isoWeekNumber = Math.round((monday - firstMonday) / 604800000) + 1;
  return `${isoYear}-W${String(isoWeekNumber).padStart(2, "0")}`;
}

function weekDates(isoWeek) {
  const [yearText, weekText] = isoWeek.split("-W");
  const januaryFourth = new Date(Date.UTC(Number(yearText), 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + ((Number(weekText) - 1) * 7));
  const start = new Date(monday);
  start.setUTCDate(monday.getUTCDate() - 2);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

function weekLabel(isoWeek) {
  const { start, end } = weekDates(isoWeek);
  const startMonth = start.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" });
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}.–${end.getUTCDate()}. ${endMonth} ${end.getUTCFullYear()}`;
  }
  return `${start.getUTCDate()}. ${startMonth}–${end.getUTCDate()}. ${endMonth} ${end.getUTCFullYear()}`;
}

function tagsFor(recipe) {
  return (recipe.tags ?? []).map((tag) => ({
    name: decodeHtml(tag.name ?? tag.slug ?? ""),
    type: normalizeName(tag.type ?? tag.slug ?? tag.name ?? ""),
  })).filter((tag) => tag.name);
}

function menuDiet(recipe, tags) {
  const searchable = normalizeName(`${recipe.name ?? ""} ${recipe.headline ?? ""}`);
  const types = tags.map((tag) => tag.type);
  if (types.includes("vegan") || /\bvegan/.test(searchable)) return { diet: "Vegan", dietGroup: "vegetarian" };
  if (types.includes("veggie") || /\bvegetar|\bveggie/.test(searchable)) return { diet: "Vegetarisch", dietGroup: "vegetarian" };
  if (types.includes("pescatarian") || /fisch|lachs|garnele|tilapia|kabeljau|pangasius|thunfisch/.test(searchable)) {
    return { diet: "Mit Fisch", dietGroup: "non-vegetarian" };
  }
  return { diet: "Nicht vegetarisch", dietGroup: "non-vegetarian" };
}

function menuDifficulty(value) {
  return ({ 1: "einfach", 2: "mittel", 3: "schwierig" })[Number(value)] ?? "nicht angegeben";
}

function menuImage(recipe) {
  if (recipe.imagePath) {
    const imagePath = recipe.imagePath.startsWith("/recipes/")
      ? recipe.imagePath
      : `/recipes${recipe.imagePath.startsWith("/") ? "" : "/"}${recipe.imagePath}`;
    return `https://media.hellofresh.com/q_80%2Cw_1200%2Cf_auto%2Cc_limit%2Cfl_lossy${imagePath}`;
  }
  return recipe.imageLink ?? "";
}

export function parseMenuPage(html, now = new Date()) {
  const script = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!script) throw new Error("Die öffentlichen Wochendaten wurden nicht gefunden.");

  const payload = JSON.parse(script).props?.pageProps?.ssrPayload;
  const activeWeek = payload?.activeWeek;
  if (!isValidWeek(activeWeek) || !Array.isArray(payload?.courses)) {
    throw new Error("Die öffentlichen Wochendaten sind unvollständig.");
  }

  const seen = new Set();
  const recipes = [];
  for (const course of payload.courses) {
    const recipe = course?.recipe;
    if (!recipe?.id || !recipe?.name || !recipe?.websiteUrl || seen.has(recipe.id)) continue;
    if (course.isHidden || (course.hideOnSoldOut && course.isSoldOut)) continue;
    seen.add(recipe.id);
    const tags = tagsFor(recipe);
    const diet = menuDiet(recipe, tags);
    const title = decodeHtml(recipe.name);
    recipes.push({
      id: recipe.id,
      title,
      ...diet,
      time: parseDuration(recipe.prepTime ?? recipe.totalTime),
      difficulty: menuDifficulty(recipe.difficulty),
      image: menuImage(recipe),
      alt: `Foto des Gerichts ${title}.`,
      intro: decodeHtml(recipe.headline) || `Rezept für ${title}.`,
      sourceUrl: recipe.websiteUrl,
      features: tags.map((tag) => tag.name),
    });
  }
  if (!recipes.length) throw new Error("In dieser Woche wurden keine verfügbaren Gerichte gefunden.");

  const firstAvailableWeek = isValidWeek(payload.currentWeek) ? payload.currentWeek : activeWeek;
  return {
    week: activeWeek,
    weekLabel: weekLabel(activeWeek),
    availableWeeks: Array.from({ length: 6 }, (_, index) => {
      const value = addIsoWeeks(firstAvailableWeek, index);
      const label = weekLabel(value);
      return { value, label: index === 0 ? `Aktuelles Menü: ${label}` : label };
    }),
    importedAt: germanDate(now),
    checkedAt: now.toISOString(),
    dataStatus: "live",
    sourceName: "HelloFresh Deutschland",
    sourceUrl: `https://www.hellofresh.de/menus/${activeWeek}`,
    totalRecipes: recipes.length,
    recipes,
  };
}

function ingredientParts(value) {
  const clean = decodeHtml(value).replace(/\s*\([^)]*(?:enthält|allergen)[^)]*\)\s*$/i, "").trim();
  const match = /^(\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*(kg|g|ml|l|EL|TL|Stück|Packung|Dose|Becher|Bund|Prise|Zehen?)?\s+(.+)$/i.exec(clean);
  if (!match) return { name: clean, amount: "Menge laut Originalrezept" };
  const amount = `${match[1]}${match[2] ? ` ${match[2]}` : ""}`.replace(".", ",");
  return { name: match[3].trim(), amount };
}

function curatedPackaging(name, fallbackMenu) {
  const normalized = normalizeName(name);
  for (const recipe of fallbackMenu.recipes ?? []) {
    const ingredient = recipe.ingredients?.find((item) => {
      const candidate = normalizeName(item.name);
      return candidate === normalized;
    });
    if (ingredient) return ingredient.packaging;
  }
  return null;
}

function inferDiet(ingredients) {
  const names = normalizeName(ingredients.map((ingredient) => ingredient.name).join(" "));
  if (/lachs|fisch|garnele|kabeljau|seelachs|thunfisch/.test(names)) return "Mit Fisch";
  if (/fleisch|hahnchen|schwein|rind|bacon|speck|hack|chorizo|wurst/.test(names)) return "Mit Fleisch";
  if (/vegan/.test(names)) return "Vegan";
  return "Vegetarisch";
}

function imageUrl(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageUrl(value[0]);
  return value?.url ?? value?.contentUrl ?? "";
}

export function parseRecipePage(html, sourceUrl, fallbackMenu) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const recipes = [];
  for (const script of scripts) {
    try {
      collectJsonLd(JSON.parse(script[1]), recipes);
    } catch {
      // Other valid JSON-LD blocks can still provide the recipe.
    }
  }

  const data = recipes.find((item) => item.name && item.recipeIngredient?.length && item.recipeInstructions?.length);
  if (!data) throw new Error(`Keine strukturierten Rezeptdaten gefunden: ${sourceUrl}`);

  const ingredients = data.recipeIngredient.map(ingredientParts).filter((item) => item.name).map((ingredient) => {
    const packaging = curatedPackaging(ingredient.name, fallbackMenu);
    return packaging ? { ...ingredient, packaging } : ingredient;
  });
  const steps = data.recipeInstructions
    .flatMap((step) => typeof step === "string" ? step : step?.itemListElement ?? step?.text ?? [])
    .map((step) => decodeHtml(typeof step === "string" ? step : step?.text ?? step?.name ?? ""))
    .filter(Boolean);
  const title = decodeHtml(data.name);
  const pathname = new URL(sourceUrl).pathname;
  const id = pathname.split("/").filter(Boolean).at(-1).replace(/-[0-9a-f]{20,}$/i, "");
  const yieldValue = Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield;
  const servingsNumber = String(yieldValue ?? "2").match(/\d+/)?.[0] ?? "2";

  return {
    id,
    title,
    diet: inferDiet(ingredients),
    time: parseDuration(data.totalTime ?? data.cookTime ?? data.prepTime),
    difficulty: "einfach",
    image: imageUrl(data.image ?? data.thumbnailUrl),
    alt: `Foto des Gerichts ${title}.`,
    intro: decodeHtml(data.description) || `Rezept für ${title}.`,
    servings: `${servingsNumber} Portionen`,
    sourceUrl,
    ingredients,
    steps,
  };
}

export async function fetchHtml(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(url, { headers: REQUEST_HEADERS, signal: controller.signal });
    if (!response.ok) throw new Error(`HelloFresh antwortet mit Status ${response.status}: ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function germanDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export async function importCurrentMenu({ fetchImpl = fetch, week, now = new Date() }) {
  if (week && !isValidWeek(week)) throw new Error("Ungültige Kalenderwoche.");
  const sourceUrl = week ? `https://www.hellofresh.de/menus/${week}` : "https://www.hellofresh.de/menus";
  return parseMenuPage(await fetchHtml(fetchImpl, sourceUrl), now);
}

export async function importRecipe({ fetchImpl = fetch, sourceUrl, fallbackMenu }) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.hellofresh.de" || !/^\/recipes\/[a-z0-9äöüß%+._~-]+-[0-9a-f]{20,}$/i.test(url.pathname)) {
    throw new Error("Ungültige Rezeptadresse.");
  }
  return parseRecipePage(await fetchHtml(fetchImpl, url.href), url.href, fallbackMenu);
}
