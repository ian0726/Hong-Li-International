import handler from "vinext/server/app-router-entry";
import { imageResponse } from "../lib/image-resolver";
import { displayImages } from "../lib/image-source";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: unknown;
  BUCKET: unknown;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PUBLIC_API_PATHS = new Set([
  "/api/products",
  "/api/settings",
  "/api/categories",
  "/api/brands",
  "/api/catalog",
  "/api/files",
]);

function isPublicApi(pathname: string) {
  return PUBLIC_API_PATHS.has(pathname) || pathname.startsWith("/api/products/");
}

function withPublicCors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      return Response.redirect("https://ian0726.github.io/Hong-Li-International/", 302);
    }
    if(url.pathname==="/api/image") return imageResponse(request);
    const publicApi = isPublicApi(url.pathname);

    if (publicApi && request.method === "OPTIONS") {
      return withPublicCors(new Response(null, { status: 204 }));
    }

    const response = await handler.fetch(request, env, ctx);
    if (publicApi && (request.method === "GET" || request.method === "HEAD")) {
      if(request.method==="GET" && request.headers.get("Origin")==="https://ian0726.github.io" && response.ok && response.headers.get("content-type")?.includes("application/json")) {
        const data=displayImages(await response.json(),url.origin);
        const headers=new Headers(response.headers); headers.delete("content-length");headers.delete("content-encoding");headers.set("Vary","Origin");
        return withPublicCors(Response.json(data,{headers}));
      }
      return withPublicCors(response);
    }
    return response;
  },
};

export default worker;
