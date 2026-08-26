import { decodeLevel } from "../src/core/codec";
import { createLevelPageSeo, replaceSeoHead } from "../src/seo";

function isRouteRequest(request, url) {
  return request.method === "GET" && !url.pathname.includes(".");
}

function withNoIndexHeader(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, follow, max-image-preview:large");
  return headers;
}

export default {
  async fetch(request, environment) {
    const url = new URL(request.url);
    let response = await environment.ASSETS.fetch(request);
    if (response.status === 404 && isRouteRequest(request, url)) {
      const indexUrl = new URL("/index.html", url);
      response = await environment.ASSETS.fetch(new Request(indexUrl, request));
    }

    const levelCode = url.searchParams.get("level");
    if (!levelCode || !isRouteRequest(request, url) || !response.ok) {
      return response;
    }

    let level;
    try {
      level = decodeLevel(levelCode);
    } catch {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: withNoIndexHeader(response),
      });
    }

    const html = replaceSeoHead(await response.text(), createLevelPageSeo(level, url));
    const headers = withNoIndexHeader(response);
    headers.delete("Content-Length");
    headers.delete("Content-Encoding");
    headers.delete("ETag");
    headers.set("Content-Type", "text/html; charset=UTF-8");
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
