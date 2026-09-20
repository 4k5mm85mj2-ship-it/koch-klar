import { importCurrentMenu } from "./hello-fresh-importer.js";

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const CACHE_URL = "https://einfach-kochen.internal/current-menu-v1";

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

async function cacheMenu(cache, menu) {
  if (!cache) return;
  await cache.put(CACHE_URL, new Response(JSON.stringify(menu), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=2592000",
    },
  }));
}

async function refreshMenu(env, fallbackMenu, cache) {
  const menu = await importCurrentMenu({
    fetchImpl: env.HELLOFRESH_FETCH ?? fetch,
    fallbackMenu,
  });
  await cacheMenu(cache, menu);
  return menu;
}

async function serveMenu(request, env, ctx) {
  const fallbackMenu = await loadSnapshot(request, env);
  const cache = globalThis.caches?.default;
  let cachedMenu = null;

  try {
    const cachedResponse = cache ? await cache.match(CACHE_URL) : null;
    if (cachedResponse?.ok) cachedMenu = await cachedResponse.json();
  } catch {
    cachedMenu = null;
  }

  const age = cachedMenu?.checkedAt ? Date.now() - Date.parse(cachedMenu.checkedAt) : Number.POSITIVE_INFINITY;
  if (cachedMenu && age < REFRESH_AFTER_MS) {
    return jsonResponse({ ...cachedMenu, dataStatus: "live" }, request.method);
  }

  if (cachedMenu) {
    const refresh = refreshMenu(env, fallbackMenu, cache).catch(() => undefined);
    ctx?.waitUntil?.(refresh);
    return jsonResponse({ ...cachedMenu, dataStatus: "cached" }, request.method);
  }

  try {
    return jsonResponse(await refreshMenu(env, fallbackMenu, cache), request.method);
  } catch {
    return jsonResponse({
      ...fallbackMenu,
      checkedAt: new Date().toISOString(),
      dataStatus: "fallback",
    }, request.method);
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
