import { importCurrentMenu, importRecipe } from "./hello-fresh-importer.js";

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const CACHE_ROOT = "https://einfach-kochen.internal";

async function loadSnapshot(request, env) {
  const dataUrl = new URL(request.url);
  dataUrl.pathname = "/data/menu.json";
  dataUrl.search = "";
  const response = await env.ASSETS.fetch(new Request(dataUrl, request));
  if (!response.ok) throw new Error("Menu data unavailable");
  return response.json();
}

function jsonResponse(data, method = "GET") {
  return new Response(method === "HEAD" ? null : JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

async function cacheData(cache, key, data) {
  if (!cache) return;
  await cache.put(key, new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=2592000",
    },
  }));
}

async function refreshMenu(env, week, cache, cacheKey) {
  const menu = await importCurrentMenu({
    fetchImpl: env.HELLOFRESH_FETCH ?? fetch,
    week,
  });
  await cacheData(cache, cacheKey, menu);
  return menu;
}

async function serveMenu(request, env, ctx) {
  const url = new URL(request.url);
  const week = url.searchParams.get("week") || undefined;
  if (week && !/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(week)) {
    return new Response("Invalid week", { status: 400 });
  }
  const fallbackMenu = await loadSnapshot(request, env);
  const cache = globalThis.caches?.default;
  const cacheKey = `${CACHE_ROOT}/menu-v2/${week ?? "current"}`;
  let cachedMenu = null;

  try {
    const cachedResponse = cache ? await cache.match(cacheKey) : null;
    if (cachedResponse?.ok) cachedMenu = await cachedResponse.json();
  } catch {
    cachedMenu = null;
  }

  const age = cachedMenu?.checkedAt ? Date.now() - Date.parse(cachedMenu.checkedAt) : Number.POSITIVE_INFINITY;
  if (cachedMenu && age < REFRESH_AFTER_MS) {
    return jsonResponse({ ...cachedMenu, dataStatus: "live" }, request.method);
  }

  if (cachedMenu) {
    const refresh = refreshMenu(env, week, cache, cacheKey).catch(() => undefined);
    ctx?.waitUntil?.(refresh);
    return jsonResponse({ ...cachedMenu, dataStatus: "cached" }, request.method);
  }

  try {
    return jsonResponse(await refreshMenu(env, week, cache, cacheKey), request.method);
  } catch {
    if (week) return new Response("Menu data unavailable", { status: 503 });
    return jsonResponse({
      ...fallbackMenu,
      week: "fallback",
      availableWeeks: [{ value: "fallback", label: fallbackMenu.weekLabel }],
      totalRecipes: fallbackMenu.recipes?.length ?? 0,
      checkedAt: new Date().toISOString(),
      dataStatus: "fallback",
    }, request.method);
  }
}

async function serveRecipe(request, env) {
  const sourceUrl = new URL(request.url).searchParams.get("url");
  if (!sourceUrl) return new Response("Recipe URL required", { status: 400 });
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return new Response("Invalid recipe URL", { status: 400 });
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "www.hellofresh.de" || !/^\/recipes\/[a-z0-9äöüß%+._~-]+-[0-9a-f]{20,}$/i.test(parsedUrl.pathname)) {
    return new Response("Invalid recipe URL", { status: 400 });
  }

  const cache = globalThis.caches?.default;
  const recipeId = parsedUrl.pathname.split("-").at(-1);
  const cacheKey = `${CACHE_ROOT}/recipe-v1/${recipeId}`;
  try {
    const cached = cache ? await cache.match(cacheKey) : null;
    if (cached?.ok) return jsonResponse(await cached.json(), request.method);
  } catch {
    // Continue with the public source.
  }

  const fallbackMenu = await loadSnapshot(request, env);
  try {
    const recipe = await importRecipe({
      fetchImpl: env.HELLOFRESH_FETCH ?? fetch,
      sourceUrl: parsedUrl.href,
      fallbackMenu,
    });
    await cacheData(cache, cacheKey, recipe);
    return jsonResponse(recipe, request.method);
  } catch {
    const fallback = fallbackMenu.recipes?.find((recipe) => recipe.sourceUrl === parsedUrl.href);
    return fallback ? jsonResponse(fallback, request.method) : new Response("Recipe data unavailable", { status: 503 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/menu") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      }

      try {
        return await serveMenu(request, env, ctx);
      } catch {
        return new Response("Menu data unavailable", { status: 503 });
      }
    }

    if (url.pathname === "/api/recipe") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      }
      return serveRecipe(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
