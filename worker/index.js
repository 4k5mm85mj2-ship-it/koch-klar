export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/menu") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      }

      const dataUrl = new URL(request.url);
      dataUrl.pathname = "/data/menu.json";
      dataUrl.search = "";
      const dataResponse = await env.ASSETS.fetch(new Request(dataUrl, request));
      if (!dataResponse.ok) return new Response("Menu data unavailable", { status: 503 });

      const headers = new Headers(dataResponse.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.set("cache-control", "public, max-age=3600");
      return new Response(request.method === "HEAD" ? null : dataResponse.body, {
        status: 200,
        headers,
      });
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
