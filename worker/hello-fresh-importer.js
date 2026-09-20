const MENU_SOURCES = [
  "https://www.hellofresh.de/essensbox/menu",
  "https://www.hellofresh.de/recipes",
];

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

function parseDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(value ?? "");
  if (!match) return "nicht angegeben";
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes ? `${minutes} Minuten` : "nicht angegeben";
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
      return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
    });
    if (ingredient) return ingredient.packaging;
  }
  return null;
}

function generatedPackaging(name) {
  const value = normalizeName(name);
  const rules = [
    [/hack|filet|fleisch|hahnchen|schwein|rind|bacon/, "Flache, gekühlte Kunststoffverpackung; Form und Etikett können je nach Lieferung variieren."],
    [/lachs|fisch|garnele/, "Flache, gekühlte Kunststoffverpackung mit versiegelten Rändern; Etikett prüfen."],
    [/spaghetti|nudel|pasta/, "Länglicher Kunststoffbeutel mit trockenen, festen Nudeln."],
    [/reis|couscous|bulgur|quinoa/, "Kleiner Kunststoffbeutel; der trockene Inhalt rieselt beim Bewegen."],
    [/sahne|joghurt|schmand|creme fraiche/, "Kleiner Becher oder Karton aus dem Kühlbereich; Produktetikett prüfen."],
    [/kase|gouda|parmesan|mozzarella/, "Kleine, gekühlte Kunststoffverpackung; Form und Inhalt sind je nach Käsesorte unterschiedlich."],
    [/bruhe|gewurz|chili|mix/, "Kleines, flaches Sachet mit Pulver oder Gewürzmischung."],
    [/pesto|tomatenmark|ketchup|sauce|dressing/, "Kleines, flaches Sachet oder Beutelchen mit weichem oder flüssigem Inhalt."],
    [/petersilie|basilikum|koriander|oregano|krauter/, "Leichter Klarsichtbeutel mit weichen Blättern und dünnen Stielen."],
    [/zwiebel|knoblauch|kartoffel|paprika|zucchini|karotte|porree|pilz|champignon|tomate/, "Lose oder in einem transparenten Gemüsebeutel; Form und Größe können variieren."],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1]
    ?? "Die Verpackung kann je nach Lieferung variieren. Prüfe das Produktetikett und die Zutatenbezeichnung.";
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

  const ingredients = data.recipeIngredient.map(ingredientParts).filter((item) => item.name).map((ingredient) => ({
    ...ingredient,
    packaging: curatedPackaging(ingredient.name, fallbackMenu) ?? generatedPackaging(ingredient.name),
  }));
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

async function fetchHtml(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
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

export async function importCurrentMenu({ fetchImpl = fetch, fallbackMenu, now = new Date() }) {
  let urls = [];
  for (const source of MENU_SOURCES) {
    try {
      urls = extractRecipeUrls(await fetchHtml(fetchImpl, source));
      if (urls.length >= 4) break;
    } catch {
      // Try the next official public source.
    }
  }
  if (urls.length < 4) throw new Error("Im öffentlichen HelloFresh-Menü wurden nicht genügend Rezepte gefunden.");

  const recipes = await Promise.all(urls.slice(0, 4).map(async (url) => parseRecipePage(
    await fetchHtml(fetchImpl, url),
    url,
    fallbackMenu,
  )));
  if (recipes.some((recipe) => !recipe.image || !recipe.steps.length || !recipe.ingredients.length)) {
    throw new Error("Das aktualisierte Menü ist unvollständig.");
  }

  return {
    weekLabel: "Aktuelles Wochenmenü",
    importedAt: germanDate(now),
    checkedAt: now.toISOString(),
    dataStatus: "live",
    sourceName: "HelloFresh Deutschland",
    sourceUrl: "https://www.hellofresh.de/essensbox/menu",
    recipes,
  };
}
