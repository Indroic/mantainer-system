import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";

import serverEntry from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const clientDir = join(process.cwd(), "dist/client");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

function getContentType(filePath) {
  return contentTypes.get(extname(filePath)) || "application/octet-stream";
}

async function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/") return false;

  const normalizedPath = normalize(pathname).replace(/^([.][.][/\\])+/, "").replace(/^[/\\]+/, "");
  const filePath = join(clientDir, normalizedPath);

  if (!filePath.startsWith(clientDir)) return false;

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) return false;

    res.statusCode = 200;
    res.setHeader("content-type", getContentType(filePath));
    res.setHeader("cache-control", "public, max-age=31536000, immutable");

    if (req.method === "HEAD") {
      res.end();
      return true;
    }

    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function toRequest(req) {
  const protocol = req.socket.encrypted ? "https" : "http";
  const requestUrl = new URL(req.url || "/", `${protocol}://${req.headers.host || `${host}:${port}`}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }

  const init = {
    method: req.method || "GET",
    headers,
  };

  if (init.method !== "GET" && init.method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }

  return new Request(requestUrl, init);
}

async function handleRequest(req, res) {
  try {
    if (await tryServeStatic(req, res)) return;

    const response = await serverEntry.fetch(toRequest(req));

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("Error sirviendo la petición SSR:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
}

http.createServer(handleRequest).listen(port, host, () => {
  console.log(`TanStack Start SSR escuchando en http://${host}:${port}`);
});