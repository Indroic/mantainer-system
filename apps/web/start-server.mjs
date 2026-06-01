import http from "node:http";
import { Readable } from "node:stream";

import serverEntry from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

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